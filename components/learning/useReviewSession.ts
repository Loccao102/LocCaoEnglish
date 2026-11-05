"use client";

import { useEffect, useRef, useState } from "react";
import { APIError, getMe, type ReviewItem } from "@/lib/api";
import { getAuthToken } from "@/lib/session";
import { REVIEW_RULES, fetchReviewGrade, fetchReviewQueue, submitReviewGrade, type ReviewGradeInput, type ReviewGradeReceipt } from "@/lib/review-schedule";

type Pending = ReviewGradeInput & { schema: 1; owner: string };
type ReviewState = {
  items: ReviewItem[]; pending: Pending | null; receipt: ReviewGradeReceipt | null;
  phase: "loading" | "ready" | "pending" | "error" | "corrupt";
  error: string; warning: string; needsSignIn: boolean; missing: boolean; outdated: boolean; canSchedule: boolean;
};
// If browser storage is blocked, navigation within this tab still keeps the
// exact operation. null suppresses an older durable reference after confirmation.
const tabReferences = new Map<string, Pending | null>();
const validPending = (value: Pending, owner: string) => value.schema === 1 && value.owner === owner &&
  value.rulesVersion === REVIEW_RULES && typeof value.requestId === "string" && value.requestId.length > 0 && value.requestId.length <= 120 &&
  typeof value.itemKey === "string" && value.itemKey.length > 0 && typeof value.expectedDueAt === "string" && Number.isFinite(Date.parse(value.expectedDueAt)) && Number.isInteger(value.quality) && value.quality >= 0 && value.quality <= 5;
const matches = (receipt: ReviewGradeReceipt, pending: Pending) => receipt.requestId === pending.requestId &&
  receipt.itemKey === pending.itemKey && receipt.quality === pending.quality && receipt.expectedDueAt === pending.expectedDueAt && receipt.rulesVersion === pending.rulesVersion &&
  Number.isFinite(Date.parse(receipt.dueAt)) && Number.isFinite(Date.parse(receipt.scheduledAt)) &&
  Number.isInteger(receipt.intervalDays) && receipt.intervalDays >= 1 && Number.isFinite(receipt.ease) && receipt.ease >= 1.3 && Number.isInteger(receipt.failures) && receipt.failures >= 0;
const validItem = (item: ReviewItem) => !!item && typeof item.itemKey === "string" && !!item.itemKey && typeof item.kind === "string" &&
  typeof item.prompt === "string" && typeof item.answer === "string" && typeof item.dueAt === "string" && Number.isFinite(Date.parse(item.dueAt));

/** Mounted with an identity key; pending operations never move to a new owner. */
export default function useReviewSession(token: string) {
  const [state, setState] = useState<ReviewState>({ items: [], pending: null, receipt: null, phase: "loading", error: "", warning: "", needsSignIn: false, missing: false, outdated: false, canSchedule: false });
  const [busy, setBusy] = useState(true);
  const active = useRef(false), locked = useRef(false), sequence = useRef(0);
  const owner = useRef(""), key = useRef(""), reference = useRef<Pending | null>(null), corrupt = useRef(false);
  const supported = useRef(false);
  const current = (seq: number) => active.current && sequence.current === seq && token === getAuthToken();
  const patch = (value: Partial<ReviewState>) => setState(previous => ({ ...previous, ...value }));

  function persist(value: Pending | null) {
    tabReferences.set(key.current, value);
    try {
      if (value) localStorage.setItem(key.current, JSON.stringify(value)); else localStorage.removeItem(key.current);
    } catch {
      patch({ warning: "This browser cannot keep the recovery reference on the device. It is kept in this tab; a full reload may lose it." });
    }
  }
  function confirm(receipt: ReviewGradeReceipt, pending: Pending) {
    if (!matches(receipt, pending)) throw new Error("Receipt did not match the pending response");
    reference.current = null; persist(null);
    setState(previous => ({ ...previous, pending: null, receipt, items: previous.items.filter(item => item.itemKey !== pending.itemKey), phase: "ready", error: "", missing: false, outdated: false }));
  }
  function failure(reason: unknown, message: string) {
    const auth = reason instanceof APIError && (reason.status === 401 || reason.status === 403);
    patch({ phase: reference.current ? "pending" : "error", needsSignIn: auth,
      missing: false, outdated: false,
      error: auth ? "Sign in again to confirm this saved response. Its recovery reference is kept." : message });
  }
  async function read(seq: number) {
    if (!owner.current) {
      const me = await getMe(token);
      if (!current(seq)) return;
      if (typeof me.user.id !== "string" || !me.user.id) throw new Error("Missing account identity");
      owner.current = me.user.id; key.current = `loccao.review-grade.v1.${me.user.id}`;
      let pending = tabReferences.get(key.current) || null;
      if (!tabReferences.has(key.current)) {
        let raw: string | null = null;
        try { raw = localStorage.getItem(key.current); }
        catch { patch({ warning: "This browser cannot read local recovery references. New responses can be kept only in this tab." }); }
        if (raw) {
          try { pending = JSON.parse(raw) as Pending; if (!pending || !validPending(pending, owner.current)) throw new Error(); }
          catch { corrupt.current = true; patch({ phase: "corrupt", error: "The local review reference cannot be read. It is kept; no new scheduling request has been sent." }); return; }
        }
      }
      reference.current = pending; patch({ pending });
    }
    if (corrupt.current) { patch({ phase: "corrupt", error: "The local review reference cannot be read. It is kept; no new scheduling request has been sent." }); return; }
    const pending = reference.current;
    if (pending) {
      try {
        const receipt = await fetchReviewGrade(pending.requestId, token);
        if (!current(seq)) return;
        if (!matches(receipt, pending)) {
          corrupt.current = true;
          patch({ phase: "corrupt", error: "The local review reference differs from the saved response. It is kept; no new schedule has been sent. Leave the local reference to reload your current queue." });
          return;
        }
        confirm(receipt, pending);
      } catch (reason) {
        if (!(reason instanceof APIError && reason.status === 404)) throw reason;
        if (!current(seq)) return;
        patch({ error: "This response has not been confirmed. Refresh its saved status or retry the same response." });
      }
    }
    const data = await fetchReviewQueue(token);
    if (!current(seq)) return;
    if (data.rulesVersion !== REVIEW_RULES || data.dueOnly !== true) throw new Error("Unsupported review schedule service");
    if (data.items !== null && (!Array.isArray(data.items) || !data.items.every(validItem))) throw new Error("Invalid queue response");
    supported.current = true;
    const pendingItem = reference.current ? (data.items || []).find(item => item.itemKey === reference.current!.itemKey) : null;
    const missing = !!reference.current && !pendingItem;
    const outdated = !!reference.current && !!pendingItem && pendingItem.dueAt !== reference.current.expectedDueAt;
    patch({ items: data.items || [], phase: reference.current ? "pending" : "ready", needsSignIn: false,
      canSchedule: !missing && !outdated, missing, outdated });
  }
  async function refresh() {
    if (locked.current || !active.current || token !== getAuthToken()) return;
    locked.current = true; setBusy(true);
    supported.current = false;
    const seq = ++sequence.current;
    patch({ phase: "loading", error: "", needsSignIn: false, canSchedule: false });
    try { await read(seq); }
    catch (reason) { if (current(seq)) failure(reason, "Your review queue could not be confirmed. The pending response, if any, is kept."); }
    finally { if (current(seq)) { locked.current = false; setBusy(false); } }
  }
  useEffect(() => {
    active.current = true;
    void refresh();
    return () => { active.current = false; sequence.current++; locked.current = false; };
  }, [token]);

  async function send(pending: Pending) {
    if (locked.current || !active.current || token !== getAuthToken() || corrupt.current || !supported.current) return;
    locked.current = true; setBusy(true);
    const seq = ++sequence.current;
    patch({ error: "", needsSignIn: false, missing: false });
    try {
      const { requestId, itemKey, quality, expectedDueAt, rulesVersion } = pending;
      const receipt = await submitReviewGrade({ requestId, itemKey, quality, expectedDueAt, rulesVersion }, token);
      if (current(seq)) confirm(receipt, pending);
    } catch (reason) {
      if (current(seq)) {
        failure(reason, reason instanceof APIError && reason.status === 404
          ? "This item is no longer available. Refresh saved status before leaving its recovery reference."
          : reason instanceof APIError && reason.status === 409
            ? "This review snapshot or saved response has changed. Refresh the saved queue to resolve it before rating again."
            : "The scheduling reply was interrupted. This response is still waiting for confirmation; retry keeps the same identity and rating.");
        if (reason instanceof APIError && reason.status === 409) { supported.current = false; patch({ canSchedule: false }); }
      }
    } finally { if (current(seq)) { locked.current = false; setBusy(false); } }
  }
  function grade(quality: number) {
    const item = state.items[0];
    if (!active.current || locked.current || reference.current || !owner.current || corrupt.current || !supported.current || state.phase !== "ready" || !item || token !== getAuthToken()) return;
    let requestId: string;
    try { requestId = crypto.randomUUID(); }
    catch { patch({ error: "A recovery reference could not be created. Refresh this page before scheduling." }); return; }
    const pending: Pending = { schema: 1, owner: owner.current, requestId, itemKey: item.itemKey, quality, expectedDueAt: item.dueAt, rulesVersion: REVIEW_RULES };
    reference.current = pending; persist(pending); patch({ pending, phase: "pending", receipt: null });
    void send(pending);
  }
  function leaveReference() {
    if (!active.current || locked.current || (!corrupt.current && !state.missing && !state.outdated) || token !== getAuthToken()) return;
    reference.current = null; corrupt.current = false; persist(null);
    patch({ pending: null, error: "", missing: false, outdated: false, phase: "loading" });
    void refresh();
  }
  return { ...state, busy, refresh, grade, retry: () => { if (reference.current) void send(reference.current); }, leaveReference };
}
