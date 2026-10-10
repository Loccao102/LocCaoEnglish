"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, APIError } from "@/lib/api";
import { AUTH_EVENT, getAuthToken } from "@/lib/session";
import {
  type CEFRLevel, type LearningAttempt, type VerifiedLearningActivity,
  startLearningAttempt, resumeLearningAttempt, submitLearningAttempt, continueStoryAttempt,
} from "@/lib/learning-attempt";

export type VerifiedRoundPhase = "loading" | "active" | "submitting" | "feedback" | "load-error" | "submit-error";
type Context = { level: CEFRLevel; pack: string; round: number; score: number; streak: number; seen: string[] };
type Reference = { requestId: string; attemptId?: string; parentAttemptId?: string; pending?: string; draft?: string; context: Context };
const levels = ["A1", "A2", "B1", "B2", "C1", "C2"];
const key = (owner: string, activity: string, pack: string) => `loccao.verified-round.v1.${owner}.${activity}.${pack}`;

function readReference(storageKey: string): Reference | null {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return null;
  const ref = JSON.parse(raw) as Reference, ctx = ref?.context;
  if (!ref || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(ref.requestId) ||
    !ctx || !levels.includes(ctx.level) || typeof ctx.pack !== "string" ||
    ![ctx.round, ctx.score, ctx.streak].every(n => Number.isSafeInteger(n) && n >= 0) ||
    !Array.isArray(ctx.seen) || ctx.seen.length > 20 || ctx.seen.some(item => typeof item !== "string") ||
    ref.attemptId !== undefined && !/^[a-f0-9]{32}$/.test(ref.attemptId) ||
    ref.parentAttemptId !== undefined && !/^[a-f0-9]{32}$/.test(ref.parentAttemptId) ||
    ref.pending !== undefined && (!ref.attemptId || typeof ref.pending !== "string" || ref.pending.length > 2048) ||
    ref.draft !== undefined && (typeof ref.draft !== "string" || ref.draft.length > 2048)) {
    throw new Error("The saved round could not be read. Start a new round to continue.");
  }
  return ref;
}

export default function useVerifiedLearningRound(activity: VerifiedLearningActivity, routePack: string, initialLevel: CEFRLevel, setSize?: number) {
  const initial = (): Context => ({ level: initialLevel, pack: routePack, round: 0, score: 0, streak: 0, seen: [] });
  const [context, setContext] = useState<Context>(initial);
  const [attempt, setAttempt] = useState<LearningAttempt | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [phase, setPhase] = useState<VerifiedRoundPhase>("loading");
  const [message, setMessage] = useState(""), [storageWarning, setStorageWarning] = useState("");
  const [canRestart, setCanRestart] = useState(false);
  const reference = useRef<Reference | null>(null), sequence = useRef(0), locked = useRef(false);
  const identity = useRef({ owner: "", token: "" });
  const current = (seq: number, token: string) => seq === sequence.current && token === getAuthToken();

  function keep(ref: Reference) {
    reference.current = ref;
    try { localStorage.setItem(key(identity.current.owner, activity, routePack), JSON.stringify(ref)); setStorageWarning(""); }
    catch { setStorageWarning("Browser storage is unavailable. Keep this tab open to retry or finish this round."); }
  }
  const open = useCallback(async (fresh?: Context, parentAttemptId?: string) => {
    const seq = ++sequence.current, token = getAuthToken();
    locked.current = true; setAttempt(null); setSelected(null); setDraft(""); setPhase("loading"); setMessage(""); setCanRestart(false);
    try {
      let owner = "guest";
      if (token) {
        const me = await apiFetch<{ user: { id: string } }>("/v1/me", { headers: { Authorization: `Bearer ${token}` } });
        owner = me.user.id;
      }
      if (!current(seq, token)) return;
      if (identity.current.owner !== owner || identity.current.token !== token) reference.current = null;
      identity.current = { owner, token };
      let ref = fresh ? null : reference.current;
      if (!ref && !fresh) {
        try { ref = readReference(key(owner, activity, routePack)); }
        catch (error) {
          if (error instanceof SyntaxError || error instanceof Error && error.message.includes("saved round")) { setCanRestart(true); throw error; }
          setStorageWarning("Browser storage is unavailable. Keep this tab open to finish.");
        }
      }
      ref ??= { requestId: crypto.randomUUID(), context: fresh || initial(), ...(parentAttemptId ? { parentAttemptId } : {}) };
      if (ref.parentAttemptId && activity !== "story-choice") {
        setCanRestart(true); throw new Error("This saved continuation belongs to a different activity.");
      }
      keep(ref); setContext(ref.context);
      const next = ref.attemptId ? await resumeLearningAttempt(ref.attemptId, token) : ref.parentAttemptId ? await continueStoryAttempt(ref.parentAttemptId, token) : await startLearningAttempt({
        requestId: ref.requestId, activity, pack: ref.context.pack, cefrLevel: ref.context.level, excludeItemKeys: ref.context.seen,
      }, token);
      if (!current(seq, token)) return;
      if (next.activity !== activity || next.pack !== ref.context.pack || next.cefrLevel !== ref.context.level || next.mode !== (owner === "guest" ? "guest" : "account")) {
        setCanRestart(true); throw new Error("This saved round does not match the current player or activity.");
      }
      keep({ ...ref, attemptId: next.attemptId, ...(next.result ? { pending: undefined } : {}) });
      setAttempt(next); setSelected(next.result?.actualAnswer || ref.pending || null);
      setDraft(ref.pending || ref.draft || "");
      if (!next.result && Date.parse(next.expiresAt) <= Date.now()) {
        setCanRestart(true); throw new Error("This round expired. Start a new round to continue.");
      }
      setPhase(next.result ? "feedback" : ref.pending ? "submit-error" : "active");
      if (ref.pending && !next.result) setMessage("Your answer is waiting for confirmation. Retry the same answer.");
    } catch (error) {
      if (!current(seq, token)) return;
      if (error instanceof APIError && [400, 404, 409, 410].includes(error.status)) setCanRestart(true);
      setMessage(error instanceof Error ? error.message : "Could not open this round."); setPhase("load-error");
    } finally { if (current(seq, token)) locked.current = false; }
  }, [activity, routePack, initialLevel]);

  useEffect(() => {
    void open();
    const changed = () => { reference.current = null; setContext(initial()); void open(); };
    const storage = (event: StorageEvent) => { if (event.key === "loccao_token" || event.key === null) changed(); };
    window.addEventListener(AUTH_EVENT, changed); window.addEventListener("storage", storage);
    return () => { sequence.current++; window.removeEventListener(AUTH_EVENT, changed); window.removeEventListener("storage", storage); };
  }, [open]);

  async function submit(answer: string) {
    if (locked.current || !attempt || attempt.result || canRestart || reference.current?.pending && reference.current.pending !== answer) return;
    const seq = sequence.current, { token } = identity.current;
    if (!current(seq, token)) return;
    locked.current = true; setSelected(answer); setMessage(""); setPhase("submitting");
    keep({ ...reference.current!, pending: answer });
    try {
      const result = await submitLearningAttempt(attempt, answer, token);
      if (!current(seq, token)) return;
      keep({ ...reference.current!, pending: undefined }); setAttempt({ ...attempt, result }); setSelected(result.actualAnswer); setPhase("feedback");
    } catch (error) {
      if (!current(seq, token)) return;
      if (error instanceof APIError && error.status === 409) {
        try {
          const saved = await resumeLearningAttempt(attempt.attemptId, token);
          if (!current(seq, token)) return;
          if (saved.result) { keep({ ...reference.current!, pending: undefined }); setAttempt(saved); setSelected(saved.result.actualAnswer); setPhase("feedback"); return; }
        } catch { /* Retain the pending answer until the committed result is reachable. */ }
      }
      if (!current(seq, token)) return;
      if (error instanceof APIError && [400, 404, 410].includes(error.status)) setCanRestart(true);
      setMessage(error instanceof Error ? error.message : "Could not confirm your answer."); setPhase("submit-error");
    } finally { if (current(seq, token)) locked.current = false; }
  }
  function next() {
    if (locked.current || !attempt?.result) return;
    const ctx = reference.current!.context, result = attempt.result;
    if (activity === "story-choice") {
      if (result.story?.canContinue) void open({ ...ctx, round: ctx.round + 1 }, attempt.attemptId);
      else if (result.story?.ending) void open(initial());
      return;
    }
    const completed = setSize !== undefined && ctx.round + 1 >= setSize;
    void open({ ...ctx, round: completed ? 0 : ctx.round + 1, score: completed ? 0 : ctx.score + result.xpDelta,
      streak: completed ? 0 : result.correct ? ctx.streak + 1 : 0,
      seen: completed ? [] : [...new Set([...ctx.seen, attempt.itemKey])].slice(-20) });
  }
  const canChangeLevel = (phase === "active" || phase === "feedback") && !canRestart && !reference.current?.pending;
  function changeLevel(level: CEFRLevel) {
    // Preserve the request/pending answer until recovery resolves it. Check refs
    // as well as rendered state so a stale control cannot discard a submission.
    if (locked.current || !canChangeLevel || reference.current?.pending || !current(sequence.current, identity.current.token)) return;
    void open({ level, pack: "cefr-core", round: 0, score: 0, streak: 0, seen: [] });
  }
  function updateDraft(value: string) {
    if (locked.current || phase !== "active" || !reference.current || value.length > 2048 || !current(sequence.current, identity.current.token)) return;
    keep({ ...reference.current, draft: value }); setDraft(value);
  }
  const result = attempt?.result || null;
 function acceptAudioUpdate(next: LearningAttempt, token: string) {
   if (token !== getAuthToken() || next.activity !== activity || reference.current?.attemptId !== next.attemptId) return;
   setAttempt(previous => previous?.attemptId === next.attemptId && !previous.result ? next : previous);
   if (next.result) {
     keep({ ...reference.current, pending: undefined });
     setSelected(next.result.actualAnswer); setPhase("feedback");
   }
 }
  const score = context.score + (result?.xpDelta || 0), streak = result ? result.correct ? context.streak + 1 : 0 : context.streak;
  return { attempt, result, selected, draft, updateDraft, phase, message, storageWarning, canRestart, canChangeLevel, context, score, streak, submit, next, changeLevel, acceptAudioUpdate,
    retry: () => reference.current?.pending && attempt ? void submit(reference.current.pending) : void open(),
    restart: () => void open(activity === "story-choice" ? initial() : { ...context, score: 0, streak: 0 }),
  };
}
