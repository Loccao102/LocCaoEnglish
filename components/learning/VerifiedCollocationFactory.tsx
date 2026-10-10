"use client";

import { type CEFRLevel } from "@/lib/learning-attempt";
import useVerifiedLearningRound from "./useVerifiedLearningRound";
import LearningRoundNotice from "./LearningRoundNotice";
import styles from "./VerifiedCollocationFactory.module.css";

const SET_SIZE = 3;

const LEVELS: CEFRLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
const campaignLevels: Record<string, CEFRLevel> = {
  "travel-transit": "A2",
  "conversation-cafe": "A2",
  "conversation-clarity": "B1",
  "work-standup": "B1",
  "work-deadline": "B2",
};
const campaignLabels: Record<string, string> = {
  "travel-transit": "TRAVEL · TRANSIT",
  "conversation-cafe": "CONVERSATION · CAFE",
  "conversation-clarity": "CONVERSATION · CLARITY",
  "work-standup": "WORK · STAND-UP",
  "work-deadline": "WORK · DEADLINE",
};

export default function VerifiedCollocationFactory({ pack = "default" }: { pack?: string }) {
  const normalized = Object.hasOwn(campaignLevels, pack) ? pack : "cefr-core";
  return <CollocationRound key={normalized} pack={normalized} />;
}

function CollocationRound({ pack }: { pack: string }) {
  const verified = useVerifiedLearningRound("collocation-factory", pack, campaignLevels[pack] || "A1", SET_SIZE);
  const { attempt, result, selected, phase, context, score } = verified;
  const campaign = context.pack !== "cefr-core";
  const label = campaign ? campaignLabels[context.pack] || context.pack.replaceAll("-", " ").toUpperCase() : "A1 → C2";

  return <section className={`mini-card factory ${styles.card}`} aria-label="Collocation practice">
    <div className="mini-head"><span className="eyebrow">COLLOCATION FACTORY · {label}</span><b>Round {context.round + 1}/{SET_SIZE}</b></div>
    <div className={styles.toolbar}>
      {!campaign ? <label>CEFR <select aria-label="Collocation CEFR level" value={context.level} disabled={!verified.canChangeLevel} onChange={e => verified.changeLevel(e.target.value as CEFRLevel)}>{LEVELS.map(level => <option key={level}>{level}</option>)}</select></label> : <span>{context.level} campaign practice</span>}
      <strong>{!attempt ? "Practice" : attempt.mode === "guest" ? "Guest practice" : `${score} XP this set`}</strong>
    </div>
    <progress aria-label="Set progress" max={SET_SIZE} value={context.round + Number(!!result)} />
    <LearningRoundNotice round={verified} />
    {attempt && <>
      <h2 id="collocation-scenario">{attempt.prompt.question || "Choose the natural word pair."}</h2>
      <div className="factory-core"><small>BUILD A NATURAL PAIR</small><strong>{attempt.prompt.word} + ?</strong></div>
      <div className="factory-options" role="group" aria-labelledby="collocation-scenario">{attempt.prompt.options.map(option => {
        const state = result ? option === result.correctAnswer ? "correct" : option === selected ? "wrong" : "muted" : selected === option ? "muted" : "";
        return <button key={option} disabled={phase !== "active"} aria-pressed={selected === option} className={state} onClick={() => void verified.submit(option)}>{option}</button>;
      })}</div>
      {result && phase === "feedback" && <div className={`mini-feedback-box ${result.correct ? "success" : "error"}`}>
        <div role="status" className={styles.verdict}>
          <span>{result.correct ? "✓ Natural pair" : "Review this collocation"}</span>
          <strong>{attempt.prompt.word} {result.correctAnswer}</strong>
          {!result.correct && <p>Your choice: {result.actualAnswer}</p>}
          <p>{result.feedback}</p>
          {result.reviewAdded && <p>Added to your review queue.</p>}
          {context.round === SET_SIZE - 1 && <p>Set complete. Ready for another three?</p>}
        </div>
        <button className="button primary" onClick={verified.next}>{context.round === SET_SIZE - 1 ? "Play another set" : "Next collocation →"}</button>
      </div>}
    </>}
  </section>;
}
