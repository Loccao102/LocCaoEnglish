"use client";

import useVerifiedLearningRound from "./useVerifiedLearningRound";
import LearningRoundNotice from "./LearningRoundNotice";
import styles from "./VerifiedStoryChoice.module.css";

export default function VerifiedStoryChoice() {
  const round = useVerifiedLearningRound("story-choice", "hotel-check-in", "B1");
  const { attempt, result, phase, selected } = round;
  const story = attempt?.story, outcome = result?.story;
  const xp = (story?.history.reduce((sum, entry) => sum + entry.xp, 0) || 0) + (result?.xpDelta || 0);
  return <section className={styles.card} aria-label="Story choice practice">
    <div className={styles.toolbar}><span className="eyebrow">HOTEL CHECK-IN · B1</span>
      <b>Decision {story?.step || 1}</b><span>{attempt?.mode === "account" ? `${xp} XP on this path` : "Guest practice"}</span>
    </div>
    <LearningRoundNotice round={round} />
    {attempt && <>
      {!!story?.history.length && <details className={styles.history}><summary>Your decisions ({story.history.length})</summary>
        <ol>{story.history.map((entry, index) => <li key={index}><b>{entry.scene}</b><p>{entry.answer}</p><p>{entry.consequence}</p></li>)}</ol>
      </details>}
      <article className={styles.scene}><span className="eyebrow">YOUR GOAL · CONFIRM BOTH PAID NIGHTS</span>
        <h2>{attempt.prompt.title}</h2><p>{attempt.prompt.passage}</p>
      </article>
      <h3 id="story-question">{attempt.prompt.question}</h3>
      <div className={styles.choices} role="group" aria-labelledby="story-question">
        {attempt.prompt.options.map(option => <button key={option} aria-pressed={selected === option} disabled={phase !== "active"}
          data-verdict={result && selected === option ? result.correct ? "effective" : "review" : undefined}
          onClick={() => void round.submit(option)}>{option}</button>)}
      </div>
      {result && phase === "feedback" && <div className={styles.feedback}>
        <div role="status"><strong>{result.correct ? "✓ Effective decision" : "Consider the consequence"}</strong>
          <p>Your choice: {result.actualAnswer}</p><p>{result.feedback}</p>
          {!result.correct && <p><b>An effective response:</b> {result.correctAnswer}</p>}
          {result.reviewAdded && <p>This decision was added to your review queue.</p>}
          {outcome?.ending && <div className={styles.ending}><h3>{outcome.title}</h3><p>{outcome.text}</p>
            <span>{outcome.ending === "success" ? "Stay confirmed" : "Goal still unresolved"}</span></div>}
        </div>
        <button className="button primary" onClick={round.next}>{outcome?.canContinue ? "Continue the story →" : "Try a new story"}</button>
      </div>}
    </>}
    <p className={styles.caption}>Your choices change what happens next. Practising again does not repeat today's rewards for the same decision.</p>
  </section>;
}
