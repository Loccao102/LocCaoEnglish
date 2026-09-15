"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { apiFetch, APIError } from "@/lib/api";
import { AUTH_EVENT, getAuthToken } from "@/lib/session";
import { emptyFair, FAIR_EVENT, fairPrefix, guestFair, mergeFair, parseStored, queuedFair, queueFair, restoreFair, type FairRun, type FairSave } from "@/lib/game/fair-progress";

type Identity = { owner: string; name: string; storageMode: string };
type Snapshot = Identity & { save: FairSave; status: "loading" | "ready" | "error"; pending: number; syncing: boolean; warning: string };
type APIState = { save: FairSave; playerId: string; displayName: string; storageMode: string };
const initial: Snapshot = { owner: "", name: "Adventurer", storageMode: "device", save: emptyFair(), status: "loading", pending: 0, syncing: false, warning: "" };
const identityKey = "loccao.fair.session.v1";
const FairContext = createContext<(Snapshot & { refresh: () => Promise<void>; begin: (gameId: string) => FairRun; complete: (run: FairRun, stars: number) => Promise<string> }) | null>(null);

export function FairProgressProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Snapshot>(initial);
  const verifiedToken = useRef("");
  const stateRef = useRef(state), generation = useRef(0), flight = useRef<{ version: number; task: Promise<boolean> } | null>(null);
  const patch = useCallback((value: Partial<Snapshot>) => { stateRef.current = { ...stateRef.current, ...value }; setState(stateRef.current); }, []);
  const current = useCallback((version: number, token: string) => generation.current === version && getAuthToken() === token, []);
  const confirmed = useCallback((owner: string, incoming: FairSave) => {
    let save = mergeFair(stateRef.current.owner === owner ? stateRef.current.save : emptyFair(), incoming);
    // Another tab may have confirmed a result after this request started.
    try { save = mergeFair(save, restoreFair(parseStored(`${fairPrefix(owner)}snapshot`))); }
    catch { /* A confirmed server response still works when local storage is unavailable. */ }
    return save;
  }, []);

  const sync = useCallback((owner: string, token: string, version: number): Promise<boolean> => {
    if (flight.current?.version === version) return flight.current.task;
    const task = (async () => {
      if (!current(version, token)) return false;
      patch({ syncing: true });
      try {
        for (const entry of queuedFair(owner)) {
          if (!current(version, token)) return false;
          const result = await apiFetch<{ save: FairSave }>("/v1/fair/completions", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ runId: entry.runId, gameId: entry.gameId, stars: entry.stars }) });
          if (!current(version, token)) return false;
          const save = confirmed(owner, result.save);
          // Cache first. If storage fails, leave the run queued for an idempotent retry.
          localStorage.setItem(`${fairPrefix(owner)}snapshot`, JSON.stringify(save));
          localStorage.removeItem(`${fairPrefix(owner)}run.${entry.runId}`);
          patch({ save, pending: queuedFair(owner).length });
        }
        if (current(version, token)) patch({ warning: "", pending: 0 });
        return true;
      } catch (error) {
        if (current(version, token)) patch({ warning: error instanceof APIError && error.status === 401 ? "Sign in again to sync your queued memories. They are kept for this account." : "Your memories are waiting on this device. Reconnect and retry to save them to your account." });
        return false;
      } finally { if (current(version, token)) patch({ syncing: false }); }
    })();
    flight.current = { version, task };
    void task.finally(() => { if (flight.current?.task === task) flight.current = null; });
    return task;
  }, [confirmed, current, patch]);

  const refresh = useCallback(async () => {
    const version = ++generation.current, token = getAuthToken();
    verifiedToken.current = "";
    patch({ ...initial, status: "loading" });
    if (!token) {
      try { patch({ owner: "guest", name: "Adventurer", save: guestFair(), status: "ready" }); }
      catch (error) { patch({ owner: "guest", status: "ready", warning: error instanceof Error ? error.message : "This browser cannot save your guest scrapbook." }); }
      return;
    }
    try {
      const data = await apiFetch<APIState>("/v1/fair", { headers: { Authorization: `Bearer ${token}` } });
      if (!current(version, token)) return;
      if (!data.playerId || data.save?.version !== 1 || !data.save.games) throw new Error("The scrapbook server needs an update.");
      const identity: Identity = { owner: data.playerId, name: data.displayName, storageMode: data.storageMode };
      const save = confirmed(identity.owner, data.save);
      verifiedToken.current = token;
      patch({ ...identity, save, status: "ready" });
      try {
        localStorage.setItem(identityKey, JSON.stringify({ ...identity, token }));
        localStorage.setItem(`${fairPrefix(identity.owner)}snapshot`, JSON.stringify(save));
        const pending = queuedFair(identity.owner).length;
        patch({ pending });
        if (pending) await sync(identity.owner, token, version);
      } catch { patch({ warning: "Your account is connected, but this browser cannot keep offline memories." }); }
    } catch (error) {
      if (!current(version, token)) return;
      // Only a previously verified identity for this exact session can reopen its cache.
      if (!(error instanceof APIError && error.status === 401)) {
        try {
          const identity = parseStored(identityKey) as Identity & { token: string } | null;
          const cached = identity?.token === token ? parseStored(`${fairPrefix(identity.owner)}snapshot`) : null;
          if (identity && cached) {
            verifiedToken.current = token;
            patch({ owner: identity.owner, name: identity.name, storageMode: identity.storageMode, save: restoreFair(cached), pending: queuedFair(identity.owner).length, status: "ready", warning: "You are viewing the last saved scrapbook. New memories will wait here until you reconnect." });
            return;
          }
        } catch { /* Keep the cache and show the connection error. */ }
      }
      patch({ status: "error", warning: error instanceof APIError && error.status === 401 ? "Your session expired. Sign in again to open your scrapbook." : "Connect once to open this account’s scrapbook, or sign out to play your separate guest adventure." });
    }
  }, [confirmed, current, patch, sync]);

  useEffect(() => {
    void refresh();
    const auth = () => { void refresh(); };
    const storage = (event: StorageEvent) => {
      if (event.key === "loccao_token" || event.key === null) { auth(); return; }
      if (event.key?.startsWith(fairPrefix(stateRef.current.owner)) || event.key === "loccao.friendship-fair.v1") {
        try {
          const owner = stateRef.current.owner;
          if (owner === "guest") patch({ save: guestFair() });
          else if (owner) patch({ save: mergeFair(stateRef.current.save, restoreFair(parseStored(`${fairPrefix(owner)}snapshot`))), pending: queuedFair(owner).length });
        } catch { patch({ warning: "The scrapbook changed in another tab but could not be read. Please retry." }); }
      }
    };
    const online = () => { const s = stateRef.current; if (s.owner && s.owner !== "guest" && s.status === "ready") void sync(s.owner, getAuthToken(), generation.current); else if (s.status === "error") void refresh(); };
    window.addEventListener(AUTH_EVENT, auth); window.addEventListener("storage", storage); window.addEventListener("online", online); window.addEventListener(FAIR_EVENT, online);
    return () => { generation.current++; window.removeEventListener(AUTH_EVENT, auth); window.removeEventListener("storage", storage); window.removeEventListener("online", online); window.removeEventListener(FAIR_EVENT, online); };
  }, [patch, refresh, sync]);

  const begin = useCallback((gameId: string): FairRun => {
    if (stateRef.current.status !== "ready" || !stateRef.current.owner || getAuthToken() !== verifiedToken.current) throw new Error("Open your scrapbook before starting a game.");
    return { runId: crypto.randomUUID(), gameId, owner: stateRef.current.owner };
  }, []);
  const complete = useCallback(async (run: FairRun, stars: number) => {
    if (stateRef.current.owner !== run.owner || getAuthToken() !== verifiedToken.current || stateRef.current.status !== "ready") throw new Error("Your account changed during this game. Return to the original account to save this memory.");
    const token = getAuthToken(), version = generation.current;
    try { queueFair(run, stars); }
    catch (error) {
      // Account results can still be saved directly when browser storage is disabled.
      if (run.owner === "guest" || !token) throw error;
      const result = await apiFetch<{ save: FairSave }>("/v1/fair/completions", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ runId: run.runId, gameId: run.gameId, stars }) });
      if (current(version, token)) patch({ save: confirmed(run.owner, result.save) });
      return "Your memory is saved to your account. Offline storage is unavailable on this browser.";
    }
    if (run.owner === "guest") { patch({ save: guestFair(), warning: "" }); return "Friendship stamp and best score saved on this device."; }
    patch({ pending: queuedFair(run.owner).length });
    // Finish an existing flush, then pick up any run enqueued while it was in flight.
    await sync(run.owner, token, version);
    if (!current(version, token)) return "This memory is kept for the account you started with.";
    if (queuedFair(run.owner).some(entry => entry.runId === run.runId)) await sync(run.owner, token, version);
    return queuedFair(run.owner).some(entry => entry.runId === run.runId) ? "Memory kept on this device · waiting to sync to your account." : "Friendship stamp and best score saved to your account.";
  }, [confirmed, current, patch, sync]);

  return <FairContext.Provider value={{ ...state, refresh, begin, complete }}>{children}</FairContext.Provider>;
}
export function useFairProgress() { const value = useContext(FairContext); if (!value) throw new Error("FairProgressProvider is missing"); return value; }
