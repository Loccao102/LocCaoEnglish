"use client";

import Link from "next/link";
import useSignedInToken from "./learning/useSignedInToken";
import useWritingSession from "./learning/useWritingSession";
import styles from "./WritingLab.module.css";

const names: Record<string,string> = {taskResponse: "Task response", coherenceCohesion: "Coherence & cohesion", lexicalResource: "Vocabulary", grammarRangeAccuracy: "Grammar range & accuracy"};

export default function WritingLab() {
  const token = useSignedInToken();
  if (token === null) return <p role="status">Loading your account…</p>;
  if (!token) return <section className={styles.notice}><h2>Keep your writing and feedback together</h2><p>Sign in to save drafts, revisit submitted essays and compare revisions.</p><Link href="/account" className="button primary">Sign in</Link></section>;
  return <WritingWorkspace key={token} token={token} />;
}
function WritingWorkspace({token}: {token: string}) {
  const w = useWritingSession(token), a = w.attempt, r = w.recovery;
  const text = r?.text || "", words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const changed = !!a && text !== a.essay;
  const locked = w.busy || !!r?.pending || w.conflict || w.corrupt;
  const canWrite = a?.status === "draft" && !locked;
  return <section className={styles.workspace} aria-label="IELTS Writing practice">
    {w.storageWarning && <p role="alert" className={styles.notice}>{w.storageWarning}</p>}
    {w.error && <div role="alert" className={styles.notice}><p>{w.error}</p>
      {w.corrupt ? <button onClick={w.discardCorrupt} disabled={w.busy}>Discard unreadable browser copy and load account</button>
        : r?.pending ? <><button onClick={w.retry} disabled={w.busy}>Retry saved request</button><button onClick={w.reload} disabled={w.busy}>Check saved status</button></>
        : <button onClick={w.reload} disabled={w.busy}>Retry loading</button>}</div>}
    {w.conflict && <div role="alert" className={styles.notice}><p>This draft changed in another tab. Your local text is kept below. Copy it before loading the account version.</p><button onClick={w.useAccountCopy}>Use account version</button></div>}
    {w.busy && <p role="status">{r?.pending?.kind === "submit" ? "Saving your submission and requesting feedback…" : "Loading or saving your writing…"}</p>}
    {r?.pending && !w.busy && !w.error && <div className={styles.notice} role="status"><p>A saved request has not been confirmed. Retry it without changing the essay.</p><button onClick={w.retry}>Retry saved request</button><button onClick={w.reload}>Check saved status</button></div>}
    {!a && !w.busy && !w.corrupt && r && !r.pending && <div className={styles.notice}><h2>Develop an argument, then revise it</h2><p>Start with an original Task 2 prompt. Save drafts to your account and submit when you are ready for feedback.</p><button className="button primary" onClick={() => w.start()}>Start writing</button></div>}
    {a && <>
      <div className={styles.task}><span className="eyebrow">TASK 2 · REVISION {a.revision}</span><h2>Public transport and roads</h2><p>{a.task}</p><small>Aim for 250 words. Suggested practice time: 40 minutes.</small></div>
      <div className={styles.editor}>
        <label htmlFor="writing-essay">{w.conflict ? "Your local draft" : a.status === "draft" ? "Your essay" : "Your submitted essay"}</label>
        <textarea id="writing-essay" value={text} readOnly={!canWrite} onChange={e => w.edit(e.target.value)} placeholder="State your position, develop your reasons and support them with examples." />
        <div className={styles.meta}><span>{words} words</span><span>{[...text].length.toLocaleString()} / 12,000 characters</span></div>
        <p className={styles.saveStatus}>{w.conflict ? "This local text differs from the account version. It has been kept for you to copy." : a.status === "draft" ? changed ? "Changes kept in this browser. Save draft to sync with your account." : "Draft saved to your account." : "This submitted version is saved and cannot be edited. Create a revision to improve it."}</p>
        <div className={styles.actions}>
          {a.status === "draft" && <><button onClick={w.save} disabled={locked || !changed}>Save draft</button><button className="button primary" onClick={w.submit} disabled={locked || changed || words < 40}>Submit for feedback</button></>}
          {a.status === "draft" && <small>{changed ? "Save your latest changes before submitting." : words < 40 ? "Write at least 40 words to request feedback; aim for 250 for full practice." : "Submitting sends this essay to the configured feedback provider."}</small>}
          {a.status === "evaluating" && <><p>Feedback is in progress. Check the saved status first. If processing was interrupted, retry becomes available after {new Date(a.leaseUntil!).toLocaleTimeString()}.</p><button onClick={w.reload} disabled={w.busy}>Check saved status</button><button onClick={w.submit} disabled={locked}>Retry same submission</button></>}
          {a.status === "failed" && <><p role="alert">{a.failure}</p><button onClick={w.submit} disabled={locked}>Retry feedback</button></>}
          {(a.status === "failed" || a.status === "completed") && <button onClick={() => w.start(a.id)} disabled={locked}>Create revision</button>}
        </div>
      </div>
      {a.feedback && !w.conflict && <section className={styles.feedback} aria-label="Saved Writing feedback"><span className="eyebrow">SAVED PRACTICE FEEDBACK</span><h2>{a.feedback.overall.toFixed(1)} <small>estimated band</small></h2><p>{a.feedback.disclaimer}</p>
        <div className={styles.criteria}>{Object.entries(a.feedback.criteria).map(([key, c]) => <article key={key}><h3>{names[key] || key} <strong>{c.band.toFixed(1)}</strong></h3><blockquote>{c.evidence}</blockquote><p>{c.comment}</p></article>)}</div>
        <h3>What works</h3><ul>{a.feedback.strengths.map((s,i) => <li key={i}>{s}</li>)}</ul><h3>Focus for your next revision</h3><ol>{a.feedback.improvements.map((s,i) => <li key={i}>{s}</li>)}</ol>
        <details><summary>About this feedback</summary><p>Provider: {a.feedback.provider}. Model: {a.feedback.model}. Rubric: {a.rulesVersion}. Evaluation: {a.feedback.evaluatorVersion}.</p><p>Saved {new Date(a.completedAt!).toLocaleString()}. Feedback applies only to the submitted essay above.</p></details>
      </section>}
    </>}
    {!!w.items.length && <section className={styles.history} aria-label="Writing revisions"><h2>Your drafts and submissions</h2><p>Save changes before switching. Each submitted version keeps its own feedback.</p><ul>{w.items.map(item => <li key={item.id}><button onClick={() => void w.open(item.id)} disabled={locked || changed || item.id === a?.id}>Revision {item.revision} · {item.status}{item.feedback ? ` · ${item.feedback.overall.toFixed(1)}` : ""}</button><time dateTime={item.updatedAt}>{new Date(item.updatedAt).toLocaleString()}</time></li>)}</ul></section>}
  </section>;
}
