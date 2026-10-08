"use client";

import type { CEFRLevel } from "@/lib/learning-attempt";
import useVerifiedLearningRound from "./learning/useVerifiedLearningRound";
import useListeningPlayback from "./learning/useListeningPlayback";
import LearningRoundNotice from "./learning/LearningRoundNotice";
import styles from "./learning/VerifiedListening.module.css";
import dictation from "./learning/VerifiedDictation.module.css";

export default function DictationTrainer() {
  const round = useVerifiedLearningRound("dictation", "cefr-core", "B1", 3);
  const audio = useListeningPlayback(round);
  const { attempt, result, phase, context } = round;
  const events = attempt?.listening?.events || [];
  const completed = events.filter(event => event.status === "completed");
  const busy = audio.phase !== "idle";
  const ready = completed.length > 0 && !audio.pending && !busy;
  const grade = result?.dictation;
  const answer = result?.actualAnswer ?? round.draft;
  const answerBytes = new TextEncoder().encode(answer).length;

  return <section className={styles.card} aria-label="Dictation practice">
    <div className={styles.toolbar}>
      <label className={dictation.level}>Difficulty
        <select aria-label="Dictation difficulty" value={context.level}
          disabled={busy || !["active", "feedback"].includes(phase)}
          onChange={event => round.changeLevel(event.target.value as CEFRLevel)}>
          <option value="A2">A2 · Everyday sentences</option>
          <option value="B1">B1 · Connected speech</option>
          <option value="B2">B2 · Complex sentences</option>
        </select>
      </label>
      <b>Round {context.round + 1}/3</b>
      <span>{attempt?.mode === "account" ? `${round.score} XP this set` : "Guest practice"}</span>
    </div>
    <progress aria-label="Set progress" max={3} value={context.round + Number(!!result)} />
    <LearningRoundNotice round={round} />
    {attempt && <>
      <div className={styles.audio}>
        <span className={styles.icon} aria-hidden="true">♫</span>
        <div><h2>Catch every word</h2><p>Listen to the whole sentence. Replay or slow it down whenever you need.</p></div>
        {phase === "active" && <div className={styles.controls}>
          {audio.pending && !busy ? <button onClick={() => void audio.play()}>Retry audio request</button> : <>
            <button disabled={busy} onClick={() => void audio.play(1)}>{completed.length ? "Replay audio" : "Play audio"}</button>
            <button disabled={busy} onClick={() => void audio.play(.72)}>Listen slowly · 0.72×</button>
          </>}
          {busy && <button onClick={audio.stop} disabled={audio.phase === "saving"}>Stop audio</button>}
        </div>}
        <p role="status" className={styles.status}>{audio.phase === "loading" ? "Preparing audio…" : audio.phase === "playing" ? "Playing — listen to the end…" : audio.phase === "saving" ? "Confirming playback…" : audio.message || (completed.length ? "Playback restored. Your sentence is ready to check." : "Play the sentence before checking your answer.")}</p>
        {audio.warning && <p role="alert">{audio.warning}</p>}
        {audio.message && !busy && !ready && phase === "active" && <button className={styles.reset} onClick={round.restart}>Start a new round</button>}
        <p className={styles.caption}>{completed.length} completed · {Math.max(0, completed.length - 1)} replays · {completed.filter(event => event.rate < 1).length} slow listens · {events.filter(event => event.status === "failed").length} failed</p>
        {events.some(event => event.provider === "browser-speech-synthesis") && <p className={styles.caption}>Using your browser&apos;s English voice.</p>}
      </div>
      <label className={dictation.label} htmlFor="dictation-answer">Type the sentence you hear</label>
      <p id="dictation-help">Capital letters and punctuation do not affect your score. Keep contractions as spoken, such as “I&apos;ve”.</p>
      <textarea id="dictation-answer" className={dictation.answer} aria-describedby="dictation-help"
        value={answer} readOnly={phase !== "active"} spellCheck={false} autoComplete="off" autoCorrect="off" autoCapitalize="off"
        maxLength={2048} onChange={event => round.updateDraft(event.target.value)} placeholder="Write your sentence here…" />
      {answerBytes > 2048 && <p role="alert">This answer is too long. Shorten it before checking.</p>}
      {phase === "active" && <button disabled={!ready || !/[\p{L}\p{N}]/u.test(answer) || answerBytes > 2048}
        onClick={() => void round.submit(answer)}>Check answer</button>}
      {result && grade && phase === "feedback" && <div className={styles.feedback}>
        <div role="status"><strong>{result.correct ? "✓ Perfect dictation" : "Compare your sentence"}</strong>
          <p className={dictation.score}>{Math.floor(grade.accuracy * 100 + 1e-8)}% word accuracy</p>
          <p>{grade.matched} matched · {grade.missing} missing · {grade.extra} extra · {grade.substituted} replaced</p>
        </div>
        <p><b>Sentence you heard</b></p><blockquote>{result.correctAnswer}</blockquote>
        <ol className={dictation.words} aria-label="Word comparison">
          {grade.words.map((word, index) => <li key={index} data-kind={word.kind}>
            {word.kind === "match" ? <><span>Matched</span> {word.actual}</> : word.kind === "missing" ? <><span>Missing</span> {word.expected}</> : word.kind === "extra" ? <><span>Extra</span> {word.actual}</> : <><span>Replace</span> {word.actual} → {word.expected}</>}
          </li>)}
        </ol>
        <p>{result.feedback}</p>
        {result.reviewAdded && <p>This sentence was added to your review queue.</p>}
        <button onClick={round.next}>{context.round === 2 ? "Play another set" : "Next sentence →"}</button>
      </div>}
    </>}
    <p className={styles.caption}>Guided dictation · Three sentences per set, at your own pace. Every missing, extra or replaced word reduces accuracy. A complete match can earn 20 XP on your first attempt at that sentence today.</p>
  </section>;
}
