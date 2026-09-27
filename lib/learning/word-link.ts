import { apiFetch } from "../api";

export type WordLinkVerdict = {
  correct: boolean; actualAnswer: string; correctAnswer: string; note: string;
  xpDelta: number; reviewAdded: boolean; progressionApplied: boolean;
  evidence: "server-objective"; assisted: boolean; submittedAt: string;
};
export type WordLinkAttempt = {
  id: string; contentId: string; contentVersion: number; rulesVersion: number;
  pack: string; label: string; round: number; total: number; word: string; prompt: string;
  choices: { id: string; label: string }[]; mode: "guest" | "account";
  expiresAt: string; result?: WordLinkVerdict;
};
export type WordLinkReference = { requestId: string; round: number; attemptId?: string; pending?: string };
const auth = (token: string) => ({ Authorization: token ? `Bearer ${token}` : "" });
const base = "/v1/learning/word-link/attempts";
export const referenceKey = (owner: string, pack: string) => `loccao.learning.word-link.v1.${owner}.${pack}`;

export function readWordLinkReference(owner: string, pack: string): WordLinkReference | null {
  const raw = localStorage.getItem(referenceKey(owner, pack));
  if (!raw) return null;
  const v = JSON.parse(raw) as WordLinkReference;
  if (!v || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v.requestId) ||
    !Number.isInteger(v.round) || v.round < 0 || v.round > 100 ||
    v.attemptId !== undefined && !/^[a-f0-9]{32}$/.test(v.attemptId) ||
    v.pending !== undefined && (!v.attemptId || !/^[a-f0-9]{32}$/.test(v.pending))) {
    throw new Error("Your saved round could not be read. It has been kept on this device.");
  }
  return v;
}
export const saveWordLinkReference = (owner: string, pack: string, ref: WordLinkReference) =>
  localStorage.setItem(referenceKey(owner, pack), JSON.stringify(ref));
export const createWordLink = (token: string, pack: string, ref: WordLinkReference) =>
  apiFetch<WordLinkAttempt>(base, { method: "POST", headers: auth(token), body: JSON.stringify({ requestId: ref.requestId, pack, round: ref.round }) });
export const resumeWordLink = (token: string, id: string) =>
  apiFetch<WordLinkAttempt>(`${base}/${encodeURIComponent(id)}`, { headers: auth(token) });
export const submitWordLink = (token: string, attempt: WordLinkAttempt, choiceId: string) =>
  apiFetch<WordLinkVerdict>(`${base}/${encodeURIComponent(attempt.id)}/submit`, {
    method: "POST", headers: auth(token),
    body: JSON.stringify({ choiceId, contentVersion: attempt.contentVersion, rulesVersion: attempt.rulesVersion }),
  });
