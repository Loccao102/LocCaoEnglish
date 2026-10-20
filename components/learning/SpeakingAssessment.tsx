"use client";

import {useEffect, useRef, useState} from "react";
import {APIError, getMe} from "@/lib/api";
import {getAuthToken} from "@/lib/session";
import {acousticInput, findAcoustic, listAcoustic, retryAcoustic, startAcoustic, type AcousticInput, type AcousticReceipt} from "@/lib/acoustic";
import type {LearningAttempt} from "@/lib/learning-attempt";
import useSignedInToken from "./useSignedInToken";
import styles from "./VerifiedSpeaking.module.css";

type Recovery = {schema: 1; owner: string; attemptId: string; requestId: string};
export default function SpeakingAssessment(props: {attempt: LearningAttempt; transcript: string; audio: string; sampleId: string; recording: boolean}) {
  const token = useSignedInToken();
  return token && props.attempt.mode === "account" ? <AccountAssessment key={`${token}:${props.attempt.attemptId}`} {...props} token={token} /> : null;
}
function AccountAssessment({attempt, transcript, audio, sampleId, recording, token}: {attempt: LearningAttempt; transcript: string; audio: string; sampleId: string; recording: boolean; token: string}) {
  const [items, setItems] = useState<AcousticReceipt[]>([]), [receipt, setReceipt] = useState<AcousticReceipt | null>(null);
  const [busy, setBusy] = useState(true), [error, setError] = useState(""), [warning, setWarning] = useState("");
  const [recovery, setRecovery] = useState<Recovery | null>(null), [owner, setOwner] = useState("");
  const active = useRef(false), lock = useRef(false), storageKey = useRef("");
  const lifecycle = useRef(0);
  // The only retained upload is in memory. Recovery storage contains identity only.
  const pending = useRef<{input: AcousticInput; sampleId: string} | null>(null);
  const current = () => active.current && getAuthToken() === token;
  function apply(r: AcousticReceipt) {
    if (!current()) return;
    setReceipt(r); setItems(old => [r, ...old.filter(x => x.id !== r.id)].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0,30));
  }
  useEffect(() => {
    active.current = true;
    const generation = ++lifecycle.current;
    const alive = () => current() && lifecycle.current === generation;
    void (async () => {
      try {
        const me = await getMe(); if (!alive()) return;
        setOwner(me.user.id); storageKey.current = `loccao-acoustic.v1:${me.user.id}:${attempt.attemptId}`;
        let saved: Recovery | null = null;
        try {
          const raw = localStorage.getItem(storageKey.current);
          if (raw) {
            const value = JSON.parse(raw) as Recovery;
            if (value.schema !== 1 || value.owner !== me.user.id || value.attemptId !== attempt.attemptId || typeof value.requestId !== "string" || !/^[a-zA-Z0-9-]{16,64}$/.test(value.requestId)) throw Error();
            saved = value; setRecovery(value);
          }
        } catch {setWarning("The local request reference cannot be read. Your account history remains available.");}
        const history = await listAcoustic(token); if (!alive()) return;
        setItems(history.items);
        if (saved) {
          try {const item = await findAcoustic(saved.requestId, token); if (alive()) apply(item);}
          catch (e) {if (alive()) setError(e instanceof APIError && e.status === 404 ? "The previous upload was not found. Record a new take to request feedback." : "Could not confirm the previous request. Refresh saved status before submitting another recording.");}
        }
      } catch {if (alive()) setError("Could not load pronunciation history. Reload this page to reconnect.");}
      finally {if (alive()) setBusy(false);}
    })();
    return () => {active.current = false; lifecycle.current++; pending.current = null;};
  }, [token, attempt.attemptId]);
  const sameTake = !!pending.current && pending.current.sampleId === sampleId && pending.current.input.transcript === transcript && pending.current.input.audioBase64 === audio;
  const waiting = receipt?.status === "evaluating";
  const canRetry = sameTake && receipt && ["ready", "failed", "evaluating"].includes(receipt.status) && (!waiting || !receipt.leaseUntil || Date.now() >= Date.parse(receipt.leaseUntil));
  async function refresh() {
    if (lock.current || !current()) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const history = await listAcoustic(token); if (!current()) return; setItems(history.items);
      if (recovery) apply(await findAcoustic(recovery.requestId, token));
    } catch {if (current()) setError("Could not confirm saved status. Your request reference is kept; refresh again when connected.");}
    finally {lock.current = false; if (current()) setBusy(false);}
  }
  async function assess() {
    if (lock.current || !current() || !owner || !audio || recording) return;
    // An uncertain upload must be resolved, never silently replaced.
    if (recovery && !receipt && !sameTake) {setError("Refresh saved status before starting a different recording. You can explicitly release this local request reference below."); return;}
    lock.current = true; setBusy(true); setError("");
    try {
      if (canRetry && receipt) {apply(await retryAcoustic(receipt, pending.current!.input.audioBase64, token)); return;}
      if (sameTake && pending.current && !receipt) {apply(await startAcoustic(pending.current.input, token)); return;}
      if (sameTake && receipt) return;
      const input = acousticInput(attempt, transcript, audio);
      pending.current = {input, sampleId};
      const next: Recovery = {schema: 1, owner, attemptId: attempt.attemptId, requestId: input.requestId};
      setRecovery(next); setReceipt(null);
      try {localStorage.setItem(storageKey.current, JSON.stringify(next));}
      catch {setWarning("This browser cannot keep a recovery reference. Account history will still retain confirmed requests.");}
      apply(await startAcoustic(input, token));
    } catch (e) {
      if (current()) setError(e instanceof APIError && e.status === 400 ? "This recording was rejected. Record a new take, then release the rejected local request reference before trying again." : "The reply was interrupted. Refresh saved status or retry this exact recording; it will not create a duplicate assessment.");
    } finally {lock.current = false; if (current()) setBusy(false);}
  }
  function release() {
    pending.current = null; setReceipt(null); setRecovery(null); setError("");
    try {localStorage.removeItem(storageKey.current);} catch {setWarning("Could not remove the local request reference.");}
  }
  return <aside className={styles.feedback} aria-label="Saved pronunciation assessments">
    <h3>Pronunciation history</h3>
    <p>Request an acoustic assessment for this recording. Feedback is saved to your account; audio stays in memory and is sent only when requested. Reloading does not resend audio.</p>
    <div className={styles.actions}>
      <button disabled={busy || recording || !owner || !audio || sameTake && (!!receipt && !canRetry)} onClick={() => void assess()}>{busy ? "Saving pronunciation…" : canRetry ? "Retry this recording" : sameTake && receipt?.status === "completed" ? "Recording assessed" : "Assess this recording"}</button>
      <button disabled={busy} onClick={() => void refresh()}>Refresh saved status</button>
      {recovery && <button disabled={busy} onClick={release}>Release local request reference</button>}
    </div>
    {warning && <p role="status">{warning}</p>}{error && <p role="alert">{error}</p>}
    {receipt && <p role="status">Saved request: {receipt.status}. {receipt.failure || (waiting ? "Refresh to check its result." : "")}{receipt.status !== "completed" && !sameTake ? " The original audio is not available here. Record a new take for another assessment." : ""}</p>}
    {!busy && !items.length && <p>No saved assessments yet.</p>}
    {items.map(item => <details key={item.id} className={styles.receipt}>
      <summary>{item.status === "completed" && item.feedback ? `${item.feedback.overall} / 100` : item.status} · {item.reference}</summary>
      <p>Recorded phrase: {item.reference}</p><p>Reported transcript: {item.transcript || "Not supplied"}</p>
      <p>{new Date(item.createdAt).toLocaleString()} · Sample {item.sample.sha256.slice(0,12)} · {item.sample.durationSec.toFixed(2)} seconds</p>
      {item.failure && <p>{item.failure}</p>}
      {item.feedback && <>
        <p>Source: {item.feedback.provider}. Model revision: unspecified by provider. Method: {item.feedback.methodVersion}.</p>
        <ul>{Object.entries(item.feedback.scores).map(([name,score]) => <li key={name}>{name}: {score == null ? "Unavailable" : `${score} / 100`}</li>)}</ul>
        {!!item.feedback.words?.length && <details><summary>Word and sound feedback</summary><ul>{item.feedback.words.map((word,i) => <li key={i}>{word.word}: {word.accuracy ?? "Unavailable"} · {word.errorType}{!!word.phonemes?.length && <ul>{word.phonemes.map((sound,j) => <li key={j}>{sound.phoneme}: {sound.accuracy ?? "Unavailable"}</li>)}</ul>}</li>)}</ul></details>}
        <ul>{item.feedback.coaching.map((tip,i) => <li key={i}>{tip}</li>)}</ul><p>{item.feedback.disclaimer}</p>
      </>}
      <p>No XP or IELTS band is awarded for this assessment. Raw audio is not saved.</p>
    </details>)}
  </aside>;
}
