import {apiFetch, type PronunciationScore} from "./api";
import type {LearningAttempt} from "./learning-attempt";

export type AcousticReceipt = {
  id: string; requestId: string; attemptId: string; reference: string; transcript: string;
  contentVersion: string; transcriptRulesVersion: string; rulesVersion: string;
  sample: {sha256: string; bytes: number; sampleRate: number; durationSec: number};
  status: "ready" | "evaluating" | "failed" | "completed"; generation: number;
  leaseUntil?: string; failure?: string; createdAt: string; updatedAt: string;
  feedback?: PronunciationScore & {model: string; methodVersion: string; locale: string};
};
export type AcousticInput = {requestId: string; attemptId: string; transcript: string; contentVersion: string; transcriptRulesVersion: string; rulesVersion: string; audioBase64: string};
const base = "/v1/speaking/assessments";
const auth = (token: string) => ({Authorization: `Bearer ${token}`});
export function listAcoustic(token: string) {return apiFetch<{items: AcousticReceipt[]}>(base, {headers: auth(token)});}
export function findAcoustic(requestId: string, token: string) {return apiFetch<AcousticReceipt>(`${base}/by-request/${encodeURIComponent(requestId)}`, {headers: auth(token)});}
export function startAcoustic(input: AcousticInput, token: string) {return apiFetch<AcousticReceipt>(base, {method: "POST", headers: auth(token), body: JSON.stringify(input)});}
export function retryAcoustic(receipt: AcousticReceipt, audioBase64: string, token: string) {return apiFetch<AcousticReceipt>(`${base}/${encodeURIComponent(receipt.id)}/retry`, {method: "POST", headers: auth(token), body: JSON.stringify({generation: receipt.generation, audioBase64})});}
export function acousticInput(a: LearningAttempt, transcript: string, audioBase64: string): AcousticInput {
  return {requestId: crypto.randomUUID(), attemptId: a.attemptId, transcript, audioBase64, contentVersion: a.contentVersion, transcriptRulesVersion: a.rulesVersion, rulesVersion: "speaking-acoustic.v1"};
}
