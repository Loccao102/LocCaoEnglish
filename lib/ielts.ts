import { apiFetch } from "@/lib/api";

export type ObjectiveScore = {
  section: string; testType: string; rawScore: number; maxScore: number;
  band: number; percentage: number; method: string; disclaimer: string;
};
export type IELTSAttempt = {
  id: string; section: string; testType: string; rawScore?: number; maxScore?: number;
  band: number; source: string; createdAt: string; evidence: string; legacy: boolean;
  attemptId?: string; contentVersion?: string; rulesVersion?: string;
  methodVersion?: string; provider?: string;
};

// Listening remains a client-reported estimate until its own attempt migration.
// Reading uses the shared learning attempt API and never submits a score tally.
export function scoreObjective(section: "listening", correct: number, total = 40, testType = "academic", token = "") {
  return apiFetch<{ result: ObjectiveScore; attempt: IELTSAttempt }>("/v1/ielts/objective-score", {
    method: "POST", headers: { Authorization: token ? `Bearer ${token}` : "" },
    body: JSON.stringify({ section, testType, correct, total }),
  });
}
export function getIELTSHistory(token: string, signal?: AbortSignal) {
  return apiFetch<{ items: IELTSAttempt[] }>("/v1/ielts/history", {
    headers: { Authorization: token ? `Bearer ${token}` : "" }, signal,
  });
}
