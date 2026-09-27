"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch, APIError } from "@/lib/api";
import { AUTH_EVENT, getAuthToken } from "@/lib/session";
import {
  createWordLink, resumeWordLink, submitWordLink, readWordLinkReference, saveWordLinkReference,
  type WordLinkAttempt, type WordLinkReference,
} from "@/lib/learning/word-link";

export default function WordLinkGame() {
  return <Suspense fallback={<p role="status">Opening Word Link…</p>}><WordLinkEntry /></Suspense>;
}
function WordLinkEntry() {
  const query = useSearchParams(), pack = query.get("pack") || "default";
  return <WordLinkRound key={pack} pack={pack} duel={!!query.get("challenge")} />;
}
function WordLinkRound({ pack, duel }: { pack: string; duel: boolean }) {
  const [attempt, setAttempt] = useState<WordLinkAttempt | null>(null);
  const [pending, setPending] = useState("");
  const [busy, setBusy] = useState(true), [error, setError] = useState("");
  const [storageWarning, setStorageWarning] = useState("");
  const [canRestart, setCanRestart] = useState(false);
  const identity = useRef({ owner: "", token: "" }), generation = useRef(0), locked = useRef(false);
  const reference = useRef<WordLinkReference | null>(null);
  const current = (version: number, token: string) => generation.current === version && getAuthToken() === token;

  function keep(ref: WordLinkReference) {
    reference.current = ref;
    try { saveWordLinkReference(identity.current.owner, pack, ref); setStorageWarning(""); }
    catch { setStorageWarning("Browser storage is unavailable. Keep this tab open to resume or retry this round."); }
  }

  const open = useCallback(async (freshRound?: number) => {
    const version = ++generation.current, token = getAuthToken();
    locked.current = true; setBusy(true); setError(""); setAttempt(null); setPending(""); setCanRestart(false);
    try {
      let owner = "guest";
      if (token) {
        const me = await apiFetch<{ user: { id: string } }>("/v1/me", { headers: { Authorization: `Bearer ${token}` } });
        owner = me.user.id;
      }
      if (!current(version, token)) return;
      if (identity.current.owner !== owner || identity.current.token !== token) reference.current = null;
      identity.current = { owner, token };
      let ref = freshRound === undefined ? reference.current : null;
      if (!ref && freshRound === undefined) {
        try { ref = readWordLinkReference(owner, pack); }
        catch (cause) {
          if (cause instanceof SyntaxError || cause instanceof Error && cause.message.includes("saved round")) {
            setCanRestart(true); throw cause;
          }
          setStorageWarning("Browser storage is unavailable. Keep this tab open to finish.");
        }
      }
      ref ??= { requestId: crypto.randomUUID(), round: freshRound ?? 0 };
      keep(ref);
      const value = ref.attemptId ? await resumeWordLink(token, ref.attemptId) : await createWordLink(token, pack, ref);
      if (!current(version, token)) return;
      if (value.pack !== pack || value.round !== ref.round) throw new Error("The saved round does not match this activity.");
      if (value.mode !== (owner === "guest" ? "guest" : "account")) throw new Error("The round belongs to a different player.");
      keep({ ...ref, attemptId: value.id, ...(value.result ? { pending: undefined } : {}) });
      setAttempt(value); setPending(value.result ? "" : ref.pending || "");
      if (!value.result && Date.parse(value.expiresAt) <= Date.now()) {
        setCanRestart(true); setError("This round expired. Start a new round to continue.");
      }
    } catch (cause) {
      if (current(version, token)) {
        if (cause instanceof APIError && [404, 410].includes(cause.status)) setCanRestart(true);
        setError(cause instanceof Error ? cause.message : "Word Link could not connect. Retry to keep the same round.");
      }
    } finally { if (current(version, token)) { locked.current = false; setBusy(false); } }
  }, [pack]);

  useEffect(() => {
    void open();
    const changed = () => { reference.current = null; void open(); };
    const storage = (event: StorageEvent) => { if (event.key === "loccao_token" || event.key === null) changed(); };
    window.addEventListener(AUTH_EVENT, changed); window.addEventListener("storage", storage);
    return () => { generation.current++; window.removeEventListener(AUTH_EVENT, changed); window.removeEventListener("storage", storage); };
  }, [open]);

  async function choose(choiceId: string) {
    if (locked.current || !attempt || attempt.result || canRestart || pending && choiceId !== pending) return;
    const version = generation.current, { token } = identity.current;
    if (!current(version, token)) return;
    locked.current = true; setBusy(true); setError(""); setPending(choiceId);
    keep({ ...reference.current!, attemptId: attempt.id, pending: choiceId });
    try {
      const result = await submitWordLink(token, attempt, choiceId);
      if (!current(version, token)) return;
      keep({ ...reference.current!, pending: undefined }); setAttempt({ ...attempt, result }); setPending("");
    } catch (cause) {
      if (!current(version, token)) return;
      if (cause instanceof APIError && cause.status === 409) {
        // A second tab may have answered first. Display the committed result.
        try {
          const saved = await resumeWordLink(token, attempt.id);
          if (!current(version, token)) return;
          if (saved.result) { keep({ ...reference.current!, pending: undefined }); setAttempt(saved); setPending(""); return; }
        } catch { /* Keep the pending answer for recovery. */ }
      }
      if (!current(version, token)) return;
      if (cause instanceof APIError && [400, 404, 410].includes(cause.status)) setCanRestart(true);
      setError(cause instanceof Error ? cause.message : "Could not confirm your answer. Retry the same answer.");
    } finally { if (current(version, token)) { locked.current = false; setBusy(false); } }
  }

  const result = attempt?.result, progress = attempt ? (attempt.round + Number(!!result)) / attempt.total * 100 : 0;
  return <div className="play-shell">
    {duel && <div className="challenge-banner">Practice round · ranked Word Link submissions are paused while verified duel scoring is being built.</div>}
    <div className="play-top"><div><span className="eyebrow">WORD LINK · {attempt?.label || "CONNECTING"}</span><strong>{attempt ? `Round ${attempt.round + 1}/${attempt.total}` : "Opening your round…"}</strong></div><div className="play-score"><b>{attempt?.mode === "account" ? "Account practice" : "Guest practice"}</b></div></div>
    <div className="progress large"><i style={{ width: `${progress}%` }} /></div>
    {storageWarning && <p role="status">{storageWarning}</p>}
    {error && <div className="notice error" role="alert"><p>{error}</p>{canRestart ? <button className="button ghost" disabled={busy} onClick={() => void open(attempt?.round ?? 0)}>Start a new round</button> : <button className="button ghost" disabled={busy} onClick={() => pending ? void choose(pending) : void open()}>Retry {pending ? "same answer" : "connection"}</button>}</div>}
    {attempt && <section className="word-game-card"><p className="prompt-label">{attempt.prompt}</p><div className="word-link-arena"><div className="core-word"><small>CORE WORD</small><strong>{attempt.word}</strong><span>tap the best connection</span></div><div className="option-grid">{attempt.choices.map(choice => {
      const state = result ? choice.label === result.correctAnswer ? "correct" : choice.label === result.actualAnswer ? "wrong" : "muted" : "";
      return <button key={choice.id} disabled={busy || !!result || !!pending || canRestart} className={`word-option ${state}`} aria-pressed={pending === choice.id || result?.actualAnswer === choice.label} onClick={() => void choose(choice.id)}><span className="link-dot">•</span>{choice.label}</button>;
    })}</div></div>
      {busy && <p role="status">Checking your answer…</p>}
      {pending && !busy && !error && <button className="button primary" onClick={() => void choose(pending)}>Retry same answer</button>}
      {result && <div className={`feedback-box ${result.correct ? "success" : "error"}`}><div><strong>{result.correct ? "Connection found ✓" : `Not quite — ${result.correctAnswer}`}</strong><p>{result.note}</p><p>{attempt.mode === "guest" ? "Guest practice · no account XP." : result.progressionApplied ? `+${result.xpDelta} XP · Progress saved.${result.reviewAdded ? " Added to your review queue." : ""}` : "Practice saved. This question already counted toward your progress today."}</p></div><button className="button primary" disabled={busy} onClick={() => void open(attempt.round + 1 < attempt.total ? attempt.round + 1 : 0)}>{attempt.round + 1 === attempt.total ? "Play again" : "Next link →"}</button></div>}
    </section>}
    {!attempt && busy && <p role="status">Connecting to Word Link…</p>}
    <p className="game-caption">{attempt?.mode === "account" ? "Each question counts toward your progress once per UTC day. You can keep practising." : "Sign in before a new round to keep learning progress. Guest rounds stay separate."} <Link href="/account">Account →</Link></p>
  </div>;
}
