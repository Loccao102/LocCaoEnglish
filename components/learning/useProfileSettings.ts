"use client";

import { useEffect, useRef, useState } from "react";
import { APIError, getMe, getPlayerProfile, savePlayerProfile } from "@/lib/api";
import { getAuthToken } from "@/lib/session";
import { DEFAULT_PROFILE_FIELDS, normalizeProfileFields, profileFieldsForOwner, readLegacyGuestSettings,
  readProfileDraft, sameProfileFields, writeProfileDraft, type ProfileFields } from "@/lib/profile-settings";

type Phase = "loading" | "ready" | "saving" | "refreshing" | "error" | "uncertain" | "choice";
type SettingsState = {
  owner: string | null; fields: ProfileFields; saved: ProfileFields | null; attempted: ProfileFields | null;
  phase: Phase; confirmed: boolean; needsSignIn: boolean; message: string; storageWarning: string;
  legacy: ProfileFields | null; legacyMessage: string;
};
const initial: SettingsState = { owner: null, fields: DEFAULT_PROFILE_FIELDS, saved: null, attempted: null,
  phase: "loading", confirmed: false, needsSignIn: false, message: "", storageWarning: "", legacy: null, legacyMessage: "" };
const isAuthError = (error: unknown) => error instanceof APIError && (error.status === 401 || error.status === 403);

/** Mounted with a token key: memory, requests and drafts never move between identities. */
export default function useProfileSettings(token: string) {
  const [state, setState] = useState<SettingsState>(initial);
  const stateRef = useRef(state);
  stateRef.current = state;
  const alive = useRef(true), sequence = useRef(0), busy = useRef(false);
  const pending = useRef<ProfileFields | null>(null);
  const current = (request: number) => alive.current && request === sequence.current && token === getAuthToken();

  function store(owner: string, status: "draft" | "uncertain" | "confirmed", fields: ProfileFields) {
    const written = writeProfileDraft(owner, status, fields);
    return written.ok ? "" : written.message;
  }

  async function load() {
    if (busy.current || token !== getAuthToken()) return;
    busy.current = true;
    const request = ++sequence.current;
    setState(previous => ({ ...previous, phase: previous.owner ? "refreshing" : "loading", needsSignIn: false, message: "" }));
    try {
      if (!token) {
        const stored = readProfileDraft("guest");
        const fields = stored.kind === "valid" ? stored.draft.fields : DEFAULT_PROFILE_FIELDS;
        if (!current(request)) return;
        setState({ ...initial, owner: "guest", fields, saved: stored.kind === "valid" ? fields : null, phase: "ready",
          confirmed: stored.kind === "valid" && stored.draft.status === "confirmed",
          message: "Guest settings stay on this device. Sign in to save personal settings to an account.",
          storageWarning: stored.kind === "invalid" || stored.kind === "unavailable" ? stored.message : "" });
        return;
      }

      const [me, profile] = await Promise.all([getMe(token), getPlayerProfile(token)]);
      if (!current(request)) return;
      const owner = me.user?.id;
      const saved = typeof owner === "string" && owner ? profileFieldsForOwner(profile, owner) : null;
      if (!saved) throw new Error("Saved settings could not be verified for this account.");
      const stored = readProfileDraft(owner);
      const storageWarning = stored.kind === "invalid" || stored.kind === "unavailable" ? stored.message : "";
      const attempted = pending.current ?? (stored.kind === "valid" && stored.draft.status !== "confirmed" ? stored.draft.fields : null);
      if (attempted && !sameProfileFields(attempted, saved)) {
        pending.current = attempted;
        setState({ ...initial, owner, fields: attempted, saved, attempted, phase: "choice", storageWarning,
          message: "Your saved settings differ from your changes. Choose which version to use. This read does not tell us whether an earlier save ever completed." });
      } else {
        pending.current = null;
        const warning = attempted ? store(owner, "confirmed", saved) : storageWarning;
        setState({ ...initial, owner, fields: saved, saved, phase: "ready", confirmed: true, storageWarning: warning,
          message: attempted ? "Your changes match the settings now saved on your account." : "Saved account settings loaded." });
      }
    } catch (error) {
      if (!current(request)) return;
      setState(previous => ({ ...previous, phase: pending.current ? "uncertain" : "error", confirmed: false,
        needsSignIn: isAuthError(error), message: pending.current
          ? "Your save is still unconfirmed. Your changes are kept; refresh saved settings before another save."
          : "Your account settings could not be loaded. Try again before editing." }));
    } finally { if (current(request)) busy.current = false; }
  }

  useEffect(() => {
    alive.current = true;
    void load();
    return () => { alive.current = false; sequence.current++; busy.current = false; };
    // The parent remounts this hook whenever the captured token changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function edit(patch: Partial<ProfileFields>) {
    const previous = stateRef.current;
    if (busy.current || previous.phase !== "ready" || token !== getAuthToken()) return;
    const fields = normalizeProfileFields({ ...previous.fields, ...patch });
    if (fields) setState(value => ({ ...value, fields, confirmed: false, message: "Changes have not been saved yet." }));
  }

  async function save() {
    const previous = stateRef.current;
    if (busy.current || previous.phase !== "ready" || !previous.owner || token !== getAuthToken()) return;
    const snapshot = normalizeProfileFields(previous.fields);
    if (!snapshot) return;
    busy.current = true;
    const request = ++sequence.current, owner = previous.owner;
    pending.current = token ? snapshot : null;
    const storageWarning = store(owner, token ? "uncertain" : "confirmed", snapshot);
    setState(value => ({ ...value, phase: "saving", attempted: token ? snapshot : null, confirmed: false,
      storageWarning, needsSignIn: false, message: token ? "Saving your account settings…" : "Saving on this device…" }));
    try {
      if (!token) {
        if (current(request)) setState(value => ({ ...value, phase: "ready", confirmed: !storageWarning,
          saved: storageWarning ? value.saved : snapshot,
          message: storageWarning ? "These changes are only held in this page. Device settings could not be saved." : "Saved on this device only. No account settings were changed." }));
        return;
      }
      const response = await savePlayerProfile(snapshot, token);
      if (!current(request)) return;
      const confirmed = profileFieldsForOwner(response, owner);
      // A successful HTTP response is insufficient if it describes a different
      // account or snapshot (including a concurrent last-write-wins change).
      if (!confirmed || !sameProfileFields(confirmed, snapshot)) throw new Error("Save response did not confirm these settings.");
      const warning = store(owner, "confirmed", snapshot);
      pending.current = null;
      setState(value => ({ ...value, fields: snapshot, saved: snapshot, attempted: null, phase: "ready", confirmed: true,
        message: "Saved to your account.", storageWarning: warning }));
    } catch (error) {
      if (current(request)) setState(value => ({ ...value, phase: "uncertain", confirmed: false, needsSignIn: isAuthError(error),
        message: "Save could not be confirmed. Your changes are kept. Refresh saved settings before trying another save." }));
    } finally { if (current(request)) busy.current = false; }
  }

  function resolveChoice(useSaved: boolean) {
    const previous = stateRef.current;
    if (busy.current || previous.phase !== "choice" || !previous.owner || !previous.saved || !previous.attempted || token !== getAuthToken()) return;
    const fields = useSaved ? previous.saved : previous.attempted;
    pending.current = null;
    const storageWarning = store(previous.owner, useSaved ? "confirmed" : "draft", fields);
    setState(value => ({ ...value, fields, attempted: null, phase: "ready", confirmed: useSaved, storageWarning,
      message: useSaved ? "Using the settings returned by your latest account refresh." : "Review your changes, then save when ready." }));
  }

  function reviewLegacy() {
    if (token || busy.current || stateRef.current.phase !== "ready" || getAuthToken()) return;
    const legacy = readLegacyGuestSettings();
    setState(value => ({ ...value, legacy: legacy.fields, legacyMessage: legacy.message }));
  }
  function useLegacy() {
    const previous = stateRef.current;
    if (token || busy.current || previous.phase !== "ready" || !previous.legacy || getAuthToken()) return;
    setState(value => ({ ...value, fields: previous.legacy!, legacy: null, confirmed: false, message: "Earlier settings are ready to review. Save on this device when ready." }));
  }

  return { ...state, guest: !token, disabled: state.phase !== "ready", save, edit, refresh: load,
    useSaved: () => resolveChoice(true), reviewChanges: () => resolveChoice(false), reviewLegacy, useLegacy };
}
