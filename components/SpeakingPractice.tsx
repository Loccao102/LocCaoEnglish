"use client";

import { speakingPack } from "@/data/contentPacks";
import type { CEFRLevel } from "@/lib/learning-attempt";
import useVerifiedLearningRound from "./learning/useVerifiedLearningRound";
import useSpeakingRecorder from "./learning/useSpeakingRecorder";
import useSpeakingFeedback from "./learning/useSpeakingFeedback";
import LearningRoundNotice from "./learning/LearningRoundNotice";
import SpeakingAssessment from "./learning/SpeakingAssessment";
import styles from "./learning/VerifiedSpeaking.module.css";

export default function SpeakingPractice({ pack = "default" }: { pack?: string }) {
  const selected = speakingPack(pack);
  return <SpeakingRound key={selected.id} pack={selected.id} level={selected.cefrLevel as CEFRLevel} />;
}
function SpeakingRound({ pack, level }: { pack: string; level: CEFRLevel }) {
  const round = useVerifiedLearningRound("shadowing", pack, level, 3);
  const { attempt, result, phase } = round;
  const recording = useSpeakingRecorder(attempt?.attemptId || "", round.updateDraft);
  const actual = result?.actualAnswer ?? round.draft;
  const target = attempt?.prompt.question || "";
  const feedback = useSpeakingFeedback(attempt?.attemptId || "", actual, target, recording.audio);
  const recordingBusy = recording.phase !== "idle";
  const locked = phase !== "active" || recordingBusy || feedback.busy;
  const validText = /[\p{L}\p{N}]/u.test(actual) && new TextEncoder().encode(actual).length <= 2048;
  function listen() {
    if (!target || recordingBusy || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(target); speech.lang = "en-US"; speech.rate = .9;
    window.speechSynthesis.speak(speech);
  }
  return <section className={styles.card} aria-label="Guided speaking practice">
    <div className={styles.toolbar}><span className="scene-tag">SPEAKING · {attempt?.prompt.title || speakingPack(pack).label}</span>
      <b>Phrase {round.context.round + 1}/3</b><span>{attempt?.mode === "account" ? `${round.score} practice XP` : "Guest practice"}</span></div>
    <LearningRoundNotice round={round} />
    {attempt && <>
      <h2>Listen, say it, compare</h2>
      <blockquote className={styles.phrase}>{target}</blockquote>
      <p>Read along or listen first. Compare the words you said.</p>
      <div className={styles.actions}>
        <button disabled={recordingBusy || feedback.busy} onClick={listen}>Listen to phrase</button>
        {recording.phase === "recording" ? <button onClick={recording.stop}>Stop recording</button> :
          <button disabled={locked} onClick={() => void recording.start()}>{recording.phase === "requesting" ? "Waiting for microphone…" : "Record your voice"}</button>}
      </div>
      <p className={styles.note}>Browser speech recognition may use an online service. This app sends the saved recording only when you request coach feedback.</p>
      <p role="status">{recording.phase === "recording" ? "Recording — stops after 10 seconds." : recording.message || (recording.audio ? "Audio ready for optional pronunciation feedback." : "Record a new sample for audio feedback. Recordings are not restored after reload.")}</p>
      <label className={styles.label} htmlFor="speaking-transcript">Your transcript</label>
      <textarea id="speaking-transcript" className={styles.transcript} maxLength={2048} value={actual}
        readOnly={locked} onChange={event => round.updateDraft(event.target.value)} aria-describedby="transcript-help"
        placeholder="Record, or type what you said…" />
      <p id="transcript-help">Review or type what you said. Your text draft is saved on this device. Text matching does not assess pronunciation.</p>
      {new TextEncoder().encode(actual).length > 2048 && <p role="alert">This transcript is too long. Shorten it before checking.</p>}
      <div className={styles.actions}>
        {phase === "active" && <button disabled={locked || !validText} onClick={() => void round.submit(actual)}>Check transcript</button>}
        <button disabled={recordingBusy || feedback.busy || feedback.done || !validText && !recording.audio || !["active", "feedback"].includes(phase)}
          onClick={() => void feedback.analyze()}>{feedback.busy ? "Getting feedback…" : feedback.done ? "Feedback received" : feedback.errors.length ? "Retry coach feedback" : "Get coach feedback"}</button>
      </div>
      <p className={styles.note}>Coach feedback is optional and gives no XP. A matching transcript can earn practice XP on your first check of the phrase each day.</p>
      {feedback.errors.map(error => <p role="alert" key={error}>{error}</p>)}
      {feedback.coach && <aside className={styles.feedback} aria-label="Language coaching">
        <h3>Language coaching · text only</h3>
        <p>Source: {feedback.coach.provider}. Suggestions use your transcript; no pronunciation or IELTS band is inferred here.</p>
        <ul>{feedback.coach.coaching.map((tip, i) => <li key={i}>{tip}</li>)}</ul>
      </aside>}
      {feedback.acoustic && <aside className={styles.feedback} aria-label="Pronunciation feedback">
        <h3>Pronunciation feedback</h3>
        <p>{feedback.acoustic.acousticAssessment ? `${Math.round(feedback.acoustic.overall!)} / 100 · acoustic assessment` : "Acoustic assessment is unavailable. No pronunciation score."}</p>
        <p>Source: {feedback.acoustic.provider}. This feedback is not saved as learning progress.</p>
        {typeof feedback.acoustic.disclaimer === "string" && <p>{feedback.acoustic.disclaimer}</p>}
      </aside>}
      <SpeakingAssessment attempt={attempt} transcript={actual} audio={recording.audio} sampleId={recording.sampleId} recording={recordingBusy} />
      {result && phase === "feedback" && <div className={styles.feedback} aria-label="Transcript result">
        <h3>{result.correct ? "Your transcript matches" : "Compare your words"}</h3>
        <p>{Math.floor((result.transcriptMatch?.accuracy || 0) * 100 + 1e-8)}% transcript match</p>
        <p>{result.transcriptMatch?.missing} missing · {result.transcriptMatch?.extra} extra · {result.transcriptMatch?.substituted} replaced</p>
        <p>{result.feedback}</p>
        <button disabled={feedback.busy || recordingBusy} onClick={round.next}>Next phrase →</button>
      </div>}
    </>}
  </section>;
}
