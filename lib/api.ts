export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export type PlanItem = { id: string; title: string; skill: string; activity: string; reason: string; minutes: number; xp: number; route: string; priority: number };
export type DailyPlan = { focus: string; totalMins: number; potentialXp: number; items: PlanItem[] };
export type ReviewItem = { itemKey: string; kind: string; prompt: string; answer: string; dueAt: string; intervalDays: number; ease: number; failures: number };
export type WritingScore = { provider: string; overall: number; criteria: { taskResponse: number; coherenceCohesion: number; lexicalResource: number; grammarRangeAccuracy: number }; strengths: string[]; improvements: string[]; rewriteExample?: string; disclaimer?: string };
export type SpeakingFeedback = { provider: string; overall: number; scores: { fluency: number; pronunciationProxy: number; vocabulary: number; grammar: number }; match?: number; coaching: string[]; disclaimer?: string };
export type ConversationReply = { provider: string; reply: string; objective: string; correction?: string | null };

function token() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("loccao_token") || "";
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const auth = token();
  if (auth) headers.set("Authorization", `Bearer ${auth}`);
  const response = await fetch(`${API_URL}${path}`, { ...init, headers, cache: "no-store" });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try { const data = await response.json(); message = data.error || message; } catch {}
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export function getPlan() { return apiFetch<DailyPlan>("/v1/plan/today"); }
export function getReviews() { return apiFetch<{ items: ReviewItem[] }>("/v1/review?limit=30"); }
export function gradeReview(itemKey: string, quality: number) { return apiFetch<{ ok: boolean }>(`/v1/review/${encodeURIComponent(itemKey)}`, { method: "POST", body: JSON.stringify({ quality }) }); }
export function recordAttempt(input: { skill: string; activity: string; itemKey: string; prompt: string; answer: string; accuracy: number; durationSec?: number }) { return apiFetch<{ xpDelta: number; newConfidence: number; level: number; reviewAdded: boolean }>("/v1/attempts", { method: "POST", body: JSON.stringify({ durationSec: 0, ...input }) }); }
export function scoreWriting(essay: string, task: string) { return apiFetch<WritingScore>("/v1/ai/writing-score", { method: "POST", body: JSON.stringify({ essay, task, level: "IELTS" }) }); }
export function getSpeakingFeedback(transcript: string, target: string) { return apiFetch<SpeakingFeedback>("/v1/ai/speaking-feedback", { method: "POST", body: JSON.stringify({ transcript, target, topic: "travel" }) }); }
export function sendConversation(message: string, history: { role: string; content: string }[] = []) { return apiFetch<ConversationReply>("/v1/conversation/reply", { method: "POST", body: JSON.stringify({ message, scenario: "airport", level: "B1", history }) }); }

export async function login(email: string, password: string) {
  const result = await apiFetch<{ token: string; user: { displayName: string; email: string } }>("/v1/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  localStorage.setItem("loccao_token", result.token);
  return result;
}

export async function register(email: string, password: string, displayName: string) {
  const result = await apiFetch<{ token: string; user: { displayName: string; email: string } }>("/v1/auth/register", { method: "POST", body: JSON.stringify({ email, password, displayName }) });
  localStorage.setItem("loccao_token", result.token);
  return result;
}

export function logout() { if (typeof window !== "undefined") localStorage.removeItem("loccao_token"); }
