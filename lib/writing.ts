import {apiFetch} from "./api";

export type WritingFeedback = {
  provider: string; model: string; evaluatorVersion: string; rulesVersion: string;
  overall: number; criteria: Record<string, {band: number; evidence: string; comment: string}>;
  strengths: string[]; improvements: string[]; disclaimer: string;
};
export type WritingAttempt = {
  id: string; requestId: string; parentId?: string; revision: number; task: string;
  contentVersion: string; rulesVersion: string; version: number; essay: string;
  status: "draft" | "evaluating" | "failed" | "completed"; generation: number;
  leaseUntil?: string; feedback?: WritingFeedback; failure?: string;
  createdAt: string; updatedAt: string; completedAt?: string;
};
export type WritingInput = {version: number; essay: string; rulesVersion: string};
export type WritingOperation =
  | {kind: "start"; input: {requestId: string; parentId?: string}}
  | {kind: "save"; id: string; input: WritingInput}
  | {kind: "submit"; id: string; input: WritingInput & {generation: number}};
const base = "/v1/ielts/writing/attempts";
export function writingRequest<T>(token: string, path: string, init: RequestInit = {}) {
  return apiFetch<T>(path, {...init, headers: {Authorization: `Bearer ${token}`}});
}
export const listWriting = (token: string) => writingRequest<{items: WritingAttempt[]}>(token, base);
export const getWriting = (token: string, id: string) => writingRequest<WritingAttempt>(token, `${base}/${encodeURIComponent(id)}`);
export function runWriting(token: string, op: WritingOperation) {
  const path = op.kind === "start" ? base : `${base}/${encodeURIComponent(op.id)}/${op.kind === "save" ? "draft" : "submit"}`;
  return writingRequest<WritingAttempt>(token, path, {method: op.kind === "save" ? "PUT" : "POST", body: JSON.stringify(op.input)});
}
