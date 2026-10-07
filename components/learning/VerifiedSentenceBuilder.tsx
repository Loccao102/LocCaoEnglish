"use client";

import type { CEFRLevel } from "@/lib/learning-attempt";
import useVerifiedLearningRound from "./useVerifiedLearningRound";
import LearningRoundNotice from "./LearningRoundNotice";
import styles from "./VerifiedSentenceBuilder.module.css";

const LEVELS: CEFRLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
const campaigns: Record<string, { level: CEFRLevel; label: string }> = {
  "conversation-plans": { level: "A2", label: "CONVERSATION · MAKE PLANS" },
  "work-standup": { level: "B1", label: "WORK · STAND-UP" },
  "work-deadline": { level: "B2", label: "WORK · DELIVERY" },
};
const SET_SIZE = 3;

export default function VerifiedSentenceBuilder({ pack = "default" }: { pack?: string }) {
  const normalized = Object.hasOwn(campaigns, pack) ? pack : "cefr-core";
  return <SentenceRound key={normalized} pack={normalized} />;
}

function SentenceRound({ pack }: { pack: string }) {
  const round = useVerifiedLearningRound("sentence-builder", pack, campaigns[pack]?.level || "A1", SET_SIZE);
  const { attempt, result, phase, context, draft } = round;
  const chunks = attempt?.prompt.chunks || [];
  let picked: string[] = [];
  try {
    const parsed: unknown = JSON.parse(draft || "[]");
    if (Array.isArray(parsed) && parsed.every(id => typeof id === "string" && chunks.some(c => c.id === id)) && new Set(parsed).size === parsed.length) picked = parsed;
  } catch { /* An invalid local draft can be rebuilt without changing the attempt. */ }
  const editable = phase === "active";
  const update = (ids: string[]) => round.updateDraft(JSON.stringify(ids));
  const campaign = context.pack !== "cefr-core";

  return <section className={`mini-card ${styles.card}`} aria-label="Sentence practice">
    <div className="mini-head"><span className="eyebrow">SENTENCE BUILDER · {campaign ? campaigns[context.pack]?.label : "A1 → C2"}</span><b>Round {context.round + 1}/{SET_SIZE}</b></div>
    <div className={styles.toolbar}>
      {campaign ? <span>{context.level} campaign practice</span> : <label>CEFR <select aria-label="Sentence CEFR level" value={context.level} disabled={!editable && phase !== "feedback"} onChange={e => round.changeLevel(e.target.value as CEFRLevel)}>{LEVELS.map(level => <option key={level}>{level}</option>)}</select></label>}
      <strong>{attempt?.mode === "account" ? `${round.score} XP this set` : "Guest practice"}</strong>
    </div>
    <progress aria-label="Set progress" max={SET_SIZE} value={context.round + Number(!!result)} />
    <LearningRoundNotice round={round} />
    {attempt && <>
      <h2 id="sentence-task">{attempt.prompt.question}</h2>
      <p>Use every piece once. Tap a piece in your sentence to return it.</p>
      <div className={styles.assembly} role="group" aria-label="Your sentence">
        {result ? <p>{result.actualAnswer}</p> : picked.length ? picked.map((id, index) => <button key={id} disabled={!editable} aria-label={`Remove piece ${index + 1}: ${chunks.find(c => c.id === id)!.text}`} onClick={() => update(picked.filter(p => p !== id))}>{chunks.find(c => c.id === id)!.text}</button>) : <p>Choose the first piece below…</p>}
      </div>
      {!result && <>
        <div className={styles.bank} role="group" aria-label="Available pieces">{chunks.map(chunk => <button key={chunk.id} data-chunk-id={chunk.id} disabled={!editable || picked.includes(chunk.id)} aria-pressed={picked.includes(chunk.id)} onClick={() => update([...picked, chunk.id])}>{chunk.text}</button>)}</div>
        <p className={styles.count} aria-live="polite">{picked.length} of {chunks.length} pieces placed</p>
        <div className={styles.actions}>
          <button className="button ghost" disabled={!editable || !picked.length} onClick={() => update(picked.slice(0, -1))}>Undo</button>
          <button className="button ghost" disabled={!editable || !picked.length} onClick={() => update([])}>Reset</button>
          <button className="button primary" disabled={!editable || !chunks.length || picked.length !== chunks.length} onClick={() => void round.submit(JSON.stringify(picked))}>Check sentence</button>
        </div>
      </>}
      {result && phase === "feedback" && <div className={styles.feedback}>
        <div role="status">
          <strong>{result.correct ? "✓ Sentence complete" : "Review this sentence"}</strong>
          {!result.correct && <p>Your sentence: {result.actualAnswer}</p>}
          <p><b>Natural answer: {result.correctAnswer}</b></p>
          <p>{result.feedback}</p>
          {result.reviewAdded && <p>Added to your review queue.</p>}
          <p>This round is finished. Read the explanation, then try a new sentence.</p>
          {context.round === SET_SIZE - 1 && <p>Set complete. Ready for another three?</p>}
        </div>
        <button className="button primary" onClick={round.next}>{context.round === SET_SIZE - 1 ? "Play another set" : "Next sentence →"}</button>
      </div>}
      {!result && phase === "submit-error" && <p>Your answer is kept until it can be confirmed.</p>}
    </>}
  </section>;
}
