import { apiFetch } from "@/lib/api";

export type IELTSAttempt = {
  id: string; section: string; testType: string; rawScore?: number; maxScore?: number;
  band: number; source: string; createdAt: string; evidence: string; legacy: boolean;
  attemptId?: string; contentVersion?: string; rulesVersion?: string;
  methodVersion?: string; provider?: string;
};

export function getIELTSHistory(token: string, signal?: AbortSignal) {
  return apiFetch<{ items: IELTSAttempt[] }>("/v1/ielts/history", {
    headers: { Authorization: token ? `Bearer ${token}` : "" }, signal,
  });
}
