"use client";

import type { CEFRLevel } from "@/lib/learning-attempt";
import useVerifiedLearningRound from "./useVerifiedLearningRound";
import LearningRoundNotice from "./LearningRoundNotice";
import styles from "./VerifiedReadingRace.module.css";

const LEVELS: CEFRLevel[] = ["A2", "B1", "B2"];
const SET_SIZE = 3;

export default function VerifiedReadingRace() {
  const round = useVerifiedLearningRound("reading-race", "cefr-core", "B1", SET_SIZE);
  const { attempt, result, selected, phase, context } = round;

  return <section className={styles.reader} aria-label="Reading practice">
    <div className={styles.toolbar}>
      <label>Reading level <select aria-label="Reading level" value={context.level}
        disabled={!round.canChangeLevel}
        onChange={e => round.changeLevel(e.target.value as CEFRLevel)}>
        {LEVELS.map(level => <option key={level}>{level}</option>)}
      </select></label>
      <strong>Round {context.round + 1}/{SET_SIZE}</strong>
      <span>{attempt?.mode === "account" ? `${round.score} XP this set` : "Guest practice"}</span>
    </div>
    <progress aria-label="Set progress" max={SET_SIZE} value={context.round + Number(!!result)} />
    <LearningRoundNotice round={round} />
    {attempt && <div className={styles.layout}>
      <article className={styles.passage} aria-label="Reading passage">
        <span className="eyebrow">READ · CONNECT · EXPLAIN</span>
        <h2>{attempt.prompt.title}</h2>
        <p>{attempt.prompt.passage}</p>
        <small>Read at your own pace. You can return to the text while choosing.</small>
      </article>
      <div className={styles.question}>
        <h2 id="reading-question">{attempt.prompt.question}</h2>
        <div className={styles.options} role="group" aria-labelledby="reading-question">
          {attempt.prompt.options.map(option => <button key={option}
            disabled={phase !== "active"} aria-pressed={selected === option}
            data-verdict={result ? option === result.correctAnswer ? "correct" : option === selected ? "wrong" : "other" : undefined}
            onClick={() => void round.submit(option)}>{option}</button>)}
        </div>
        {result && phase === "feedback" && <div className={styles.feedback}>
          <div role="status">
            <strong>{result.correct ? "✓ Reading verified" : "Follow the evidence"}</strong>
            {!result.correct && <p>Your choice: {result.actualAnswer}</p>}
            <p><b>Best answer:</b> {result.correctAnswer}</p>
            <p className={styles.evidence}>{result.feedback}</p>
            {result.reviewAdded && <p>Passage and question added to your review queue.</p>}
            {context.round === SET_SIZE - 1 && <p>Set complete. Try another level or practise again.</p>}
          </div>
          <button className="button primary" onClick={round.next}>{context.round === SET_SIZE - 1 ? "Play another set" : "Next passage →"}</button>
        </div>}
      </div>
    </div>}
  </section>;
}
