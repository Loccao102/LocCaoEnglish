"use client";

import { type CEFRLevel } from "@/lib/learning-attempt";
import useVerifiedLearningRound from "./useVerifiedLearningRound";
import LearningRoundNotice from "./LearningRoundNotice";
import styles from "./VerifiedGrammarRepair.module.css";

const LEVELS: CEFRLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
const campaignLevels: Record<string, CEFRLevel> = { "travel-hotel": "B1", "conversation-clarity": "B1", "work-requirements": "B2", "work-deadline": "B2" };
export default function VerifiedGrammarRepair({ pack = "default" }: { pack?: string }) {
  const normalized = campaignLevels[pack] ? pack : "cefr-core";
  return <GrammarRound key={normalized} pack={normalized} />;
}
function GrammarRound({ pack }: { pack: string }) {
  const verified = useVerifiedLearningRound("grammar-repair", pack, campaignLevels[pack] || "A1");
  const { attempt, result, selected, phase, context, score } = verified;
  const campaign = context.pack !== "cefr-core";
  const sceneState = phase === "submitting" ? styles.submitting : phase === "feedback" ? styles.feedback : "";
  return <section className="mini-card verified-grammar-card">
    <div className="mini-head"><span className="eyebrow">GRAMMAR REPAIR · {campaign ? context.pack.replaceAll("-", " ").toUpperCase() : "A1 → C2"}</span><b>Round {context.round + 1}</b></div>
    <div className={`${styles.scene} ${sceneState}`} aria-hidden="true"><div className={styles.orbit}><i /><i /><span>ABC</span></div></div>
    <div className={styles.toolbar}>{!campaign ? <label>CEFR <select aria-label="Grammar CEFR level" value={context.level} disabled={phase === "submitting" || phase === "loading"} onChange={e => verified.changeLevel(e.target.value as CEFRLevel)}>{LEVELS.map(level => <option key={level}>{level}</option>)}</select></label> : <span>{context.level} campaign practice</span>}<strong>{attempt?.mode === "guest" ? "Guest practice" : `${score} XP this session`}</strong></div>
    <LearningRoundNotice round={verified} />
    {attempt && <><h2>{attempt.prompt.question}</h2><div className="choice-stack">{attempt.prompt.options.map(option => {
      const state = result ? option === result.correctAnswer ? "correct" : option === selected ? "wrong" : "muted" : selected === option ? "muted" : "";
      return <button key={option} disabled={phase !== "active"} aria-pressed={selected === option} onClick={() => void verified.submit(option)} className={state}>{option}</button>;
    })}</div>
      {result && phase === "feedback" && <div className={`mini-feedback-box ${result.correct ? "success" : "error"}`}><span>{result.correct ? "✓ Correct repair" : "Review this pattern"}</span><strong>{result.correctAnswer}</strong><p className={styles.note}>{result.feedback}</p><button className="button primary" onClick={verified.next}>Next verified repair →</button></div>}
    </>}
  </section>;
}
