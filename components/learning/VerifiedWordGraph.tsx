"use client";

import Link from "next/link";
import useVerifiedLearningRound from "./useVerifiedLearningRound";
import LearningRoundNotice from "./LearningRoundNotice";
import styles from "./VerifiedWordGraph.module.css";

const SET_SIZE = 3;

export default function VerifiedWordGraph() {
  const round = useVerifiedLearningRound("word-graph", "travel-network", "A2", SET_SIZE);
  const { attempt, result, phase, selected, context } = round;
  return <section className={`mini-card ${styles.card}`} aria-label="Word graph practice">
    <div className="mini-head"><span className="eyebrow">TRAVEL CONNECTIONS</span><b>Round {context.round + 1}/{SET_SIZE}</b></div>
    <div className={styles.toolbar}><span>Guided practice · A2</span><strong>{attempt?.mode === "account" ? `${round.score} XP this set` : "Guest practice"}</strong></div>
    <progress aria-label="Set progress" max={SET_SIZE} value={context.round + Number(!!result)} />
    <LearningRoundNotice round={round} />
    {attempt && <>
      <h2 id="graph-question">{attempt.prompt.question}</h2>
      <div className={styles.source}><small>STARTING WORD</small><strong>{attempt.prompt.word}</strong><span>{attempt.prompt.relation} → ?</span></div>
      <div className={styles.options} role="group" aria-labelledby="graph-question">{attempt.prompt.options.map(option => <button key={option} disabled={phase !== "active"} aria-pressed={selected === option} data-verdict={result ? option === result.correctAnswer ? "correct" : option === selected ? "wrong" : "other" : undefined} onClick={() => void round.submit(option)}>{option}</button>)}</div>
      {result && phase === "feedback" && <div className={styles.feedback}>
        <div role="status"><strong>{result.correct ? "✓ Connection found" : "Review this connection"}</strong>
          <p className={styles.connection}>{attempt.prompt.word} → {result.correctAnswer}</p>
          {!result.correct && <p>Your choice: {result.actualAnswer}</p>}
          <p>{result.feedback}</p>
          {result.reviewAdded && <p>Added to your review queue.</p>}
          {context.round === SET_SIZE - 1 && <p>Set complete. Ready for another three?</p>}
        </div>
        <div className={styles.actions}><button className="button primary" onClick={round.next}>{context.round === SET_SIZE - 1 ? "Play another set" : "Next connection →"}</button><Link className="button ghost" href="/word-graph">Explore the map</Link></div>
      </div>}
    </>}
    <p className={styles.caption}>The map is for studying; these rounds help you practise what you learn.</p>
  </section>;
}
