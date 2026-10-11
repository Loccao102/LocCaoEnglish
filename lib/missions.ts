import { apiFetch, type ProgressionState } from "./api";

export const MISSION_RULES = "conversation.v2";
export type MissionTurn = { index: number; accepted: boolean; objective: string; feedback: string };
export type BossEvaluation = {
  bossId: string; stage: number; score: number; complete: boolean;
  completed: string[]; missing: string[]; turns: MissionTurn[]; reply: string;
  rulesVersion: string; evidence: "server-rule-based-reported-dialogue";
};
export type MissionReceipt = { bossId: string; messages: string[]; legacy: boolean; evaluation?: BossEvaluation };
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
export function evaluateBoss(id: string, messages: string[], token: string) {
  return apiFetch<BossEvaluation>(`/v1/player/bosses/${encodeURIComponent(id)}/evaluate`, {
    method: "POST", headers: auth(token), body: JSON.stringify({ messages, rulesVersion: MISSION_RULES }),
  });
}
export function claimBoss(id: string, messages: string[], token: string) {
  return apiFetch<{ progression: ProgressionState; receipt: MissionReceipt }>(`/v1/player/bosses/${encodeURIComponent(id)}/complete`, {
    method: "POST", headers: auth(token), body: JSON.stringify({ messages, rulesVersion: MISSION_RULES }),
  });
}
export function getMissionReceipt(id: string, token: string) {
  return apiFetch<MissionReceipt>(`/v1/player/bosses/${encodeURIComponent(id)}/receipt`, { headers: auth(token) });
}
