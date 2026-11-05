import { apiFetch, type ReviewItem } from "@/lib/api";

export const REVIEW_RULES = "review-schedule.v1";
export type ReviewGradeInput = { requestId: string; itemKey: string; quality: number; expectedDueAt: string; rulesVersion: typeof REVIEW_RULES };
export type ReviewGradeReceipt = ReviewGradeInput & {
  scheduledAt: string; dueAt: string; intervalDays: number; ease: number; failures: number;
};
const authorization = (token: string) => ({ Authorization: token ? `Bearer ${token}` : "" });

export function fetchReviewQueue(token: string) {
  return apiFetch<{ items: ReviewItem[] | null; rulesVersion?: string; dueOnly?: boolean }>("/v1/review?limit=30&dueOnly=true", { headers: authorization(token) });
}
export function submitReviewGrade(input: ReviewGradeInput, token: string) {
  return apiFetch<ReviewGradeReceipt>(`/v1/review/${encodeURIComponent(input.itemKey)}/grades`, {
    method: "POST", headers: authorization(token), body: JSON.stringify({ requestId: input.requestId, quality: input.quality, expectedDueAt: input.expectedDueAt, rulesVersion: input.rulesVersion }),
  });
}
export function fetchReviewGrade(requestId: string, token: string) {
  return apiFetch<ReviewGradeReceipt>(`/v1/review/grades/${encodeURIComponent(requestId)}`, { headers: authorization(token) });
}
