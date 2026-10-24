import type { PlayerProfile } from "./api";

export type ProfileFields = Pick<PlayerProfile, "goal" | "cefrLevel" | "dailyMinutes" | "targetBand" | "interests">;
export type ProfileDraft = { version: 1; owner: string; status: "draft" | "uncertain" | "confirmed"; fields: ProfileFields };
export const PROFILE_DRAFT_PREFIX = "loccao.profile-settings.v1.";
export const LEGACY_PROFILE_KEY = "loccao_player_build";
export const DEFAULT_PROFILE_FIELDS: ProfileFields = { goal: "conversation", cefrLevel: "B1", dailyMinutes: 15, targetBand: 7, interests: ["daily-life"] };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validate types before normalizing the same fields accepted by the profile API. */
export function normalizeProfileFields(value: unknown): ProfileFields | null {
  if (!record(value) || typeof value.goal !== "string" || typeof value.cefrLevel !== "string"
    || typeof value.dailyMinutes !== "number" || !Number.isFinite(value.dailyMinutes) || !Number.isInteger(value.dailyMinutes)
    || typeof value.targetBand !== "number" || !Number.isFinite(value.targetBand)
    || !Array.isArray(value.interests) || !value.interests.every(item => typeof item === "string")) return null;
  const goal = value.goal.trim().toLowerCase(), cefrLevel = value.cefrLevel.trim().toUpperCase();
  if (!["conversation", "ielts", "travel", "work"].includes(goal) || !["A1", "A2", "B1", "B2", "C1", "C2"].includes(cefrLevel)) return null;
  const interests = [...new Set(value.interests.map(item => item.trim().toLowerCase()).filter(Boolean))].slice(0, 8);
  return { goal: goal as ProfileFields["goal"], cefrLevel: cefrLevel as ProfileFields["cefrLevel"],
    dailyMinutes: Math.max(5, Math.min(120, value.dailyMinutes)), targetBand: Math.round(Math.max(4, Math.min(9, value.targetBand)) * 2) / 2, interests };
}

export function sameProfileFields(first: ProfileFields, second: ProfileFields): boolean {
  return first.goal === second.goal && first.cefrLevel === second.cefrLevel && first.dailyMinutes === second.dailyMinutes
    && first.targetBand === second.targetBand && first.interests.length === second.interests.length
    && first.interests.every((interest, index) => interest === second.interests[index]);
}

export function profileFieldsForOwner(value: unknown, owner: string): ProfileFields | null {
  return record(value) && value.userId === owner ? normalizeProfileFields(value) : null;
}

type DraftRead = { kind: "valid"; draft: ProfileDraft; storageWarning?: string } | { kind: "missing" } | { kind: "invalid" | "unavailable"; message: string };
const unreadable = "Earlier device settings could not be read safely. They have been kept unchanged.";
const unavailable = "Device storage is unavailable. Changes can stay in this page, and signed-in settings can still be saved online.";
// Keep failed writes across client-side navigation, without replacing unreadable
// disk data or promising recovery after a full reload. Entries stay owner-scoped.
const volatileDrafts = new Map<string, { draft: ProfileDraft; warning: string }>();
const cloneDraft = (draft: ProfileDraft): ProfileDraft => ({ ...draft, fields: { ...draft.fields, interests: [...draft.fields.interests] } });
function rememberUnstoredDraft(draft: ProfileDraft, reason: string): { ok: false; message: string } {
  const warning = `${reason} Current changes are kept in this tab only and may be lost if you reload.`;
  if (typeof window !== "undefined") volatileDrafts.set(draft.owner, {
    draft: cloneDraft(draft.owner === "guest" && draft.status === "confirmed" ? { ...draft, status: "draft" } : draft), warning,
  });
  return { ok: false, message: warning };
}

function parseDraft(raw: string, owner: string): ProfileDraft | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!record(value) || value.version !== 1 || value.owner !== owner || typeof value.status !== "string" || !["draft", "uncertain", "confirmed"].includes(value.status)) return null;
    const fields = normalizeProfileFields(value.fields);
    return fields ? { version: 1, owner, status: value.status as ProfileDraft["status"], fields } : null;
  } catch { return null; }
}

export function readProfileDraft(owner: string): DraftRead {
  const volatile = volatileDrafts.get(owner);
  if (volatile) return { kind: "valid", draft: cloneDraft(volatile.draft), storageWarning: volatile.warning };
  try {
    const raw = window.localStorage.getItem(PROFILE_DRAFT_PREFIX + owner);
    if (raw === null) return { kind: "missing" };
    const draft = parseDraft(raw, owner);
    return draft ? { kind: "valid", draft } : { kind: "invalid", message: unreadable };
  } catch { return { kind: "unavailable", message: unavailable }; }
}

export function writeProfileDraft(owner: string, status: ProfileDraft["status"], input: ProfileFields): { ok: true } | { ok: false; message: string } {
  const fields = normalizeProfileFields(input);
  if (!owner || !fields) return { ok: false, message: "These settings could not be saved safely." };
  const draft: ProfileDraft = { version: 1, owner, status, fields };
  try {
    const key = PROFILE_DRAFT_PREFIX + owner, raw = window.localStorage.getItem(key);
    // Unknown or corrupt data belongs to the user too. Do not replace it, even
    // when online saving can proceed independently of this device draft.
    if (raw !== null && !parseDraft(raw, owner)) return rememberUnstoredDraft(draft, unreadable);
    window.localStorage.setItem(key, JSON.stringify(draft));
    volatileDrafts.delete(owner);
    return { ok: true };
  } catch { return rememberUnstoredDraft(draft, unavailable); }
}

/** Only a guest's explicit review action may read this ownerless old key. */
export function readLegacyGuestSettings(): { fields: ProfileFields | null; message: string } {
  try {
    const raw = window.localStorage.getItem(LEGACY_PROFILE_KEY);
    if (raw === null) return { fields: null, message: "No earlier device settings were found." };
    const fields = normalizeProfileFields(JSON.parse(raw));
    return { fields, message: fields ? "Review these earlier device settings before using them. The earlier copy will be kept." : unreadable };
  } catch { return { fields: null, message: unreadable }; }
}
