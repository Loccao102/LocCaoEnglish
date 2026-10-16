"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { IELTSReadingPrompt } from "@/lib/learning-attempt";
import useSignedInToken from "./useSignedInToken";
import useVerifiedLearningRound from "./useVerifiedLearningRound";
import useListeningPlayback from "./useListeningPlayback";
import LearningRoundNotice from "./LearningRoundNotice";
import styles from "./VerifiedIeltsReading.module.css";

type Question = IELTSReadingPrompt["sections"][number]["questions"][number];

function readChoices(raw: string, questions: Question[]): Record<string, string> | null {
  if (!raw) return {};
  try {
    const entries: unknown = JSON.parse(raw);
    if (!Array.isArray(entries)) return null;
    const choices: Record<string, string> = {};
    for (const entry of entries) {
      if (!Array.isArray(entry) || entry.length !== 2 || entry.some(value => typeof value !== "string")) return null;
      const [questionId, optionId] = entry as [string, string];
      const question = questions.find(item => item.id === questionId);
      if (!question || Object.hasOwn(choices, questionId) || !question.options.some(option => option.id === optionId)) return null;
      choices[questionId] = optionId;
    }
    return choices;
  } catch { return null; }
}

export default function VerifiedIeltsPaper({kind="reading"}:{kind?:"reading"|"listening"}) {
  const label=kind === "reading" ? "Reading" : "Listening";
  const token = useSignedInToken();
  if (token === null) return <p role="status">Loading your account…</p>;
  if (!token) return <section className={styles.reader}>
    <div className={styles.intro}>
      <span className="eyebrow">{kind === "reading" ? "ACADEMIC READING" : "LISTENING"} · PRACTICE</span>
      <h1>Sign in to save your {label} practice</h1>
      <p>{kind === "reading" ? "Read three original passages" : "Listen to four original recordings"}, choose answers to 40 questions, and review your saved choices with a practice band estimate.</p>
      <Link className="button primary" href="/account">Sign in</Link>
    </div>
  </section>;
  return <PaperRound key={token} kind={kind} />;
}

function PaperRound({kind}:{kind:"reading"|"listening"}) {
  const listening=kind === "listening", label=listening ? "Listening" : "Reading";
  const round = useVerifiedLearningRound(listening ? "ielts-listening" : "ielts-reading", listening ? "ielts-listening" : "ielts-academic-reading", "B2", 1);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [confirmUnanswered, setConfirmUnanswered] = useState(false);
  const { attempt, result, phase } = round;
  const reading = listening ? attempt?.prompt.listeningPaper : attempt?.prompt.reading;
  const questions = reading?.sections.flatMap(section => section.questions) || [];
  // Saved results always supply the learner's original response. A local draft
  // must never replace it when resuming after an uncertain submit.
  const choices = readChoices(result?.actualAnswer ?? round.draft, questions);
  const currentSection = reading?.sections[Math.min(sectionIndex, reading.sections.length - 1)];
  const audio = useListeningPlayback(round,{partId:listening ? currentSection?.id : undefined,maxDurationMs:listening ? 300000 : undefined});
  const audioLocked=listening && (audio.phase!=="idle" || !!audio.pending || audio.corrupt);
  const events=attempt?.listening?.events || [];
  const partEvents=events.filter(event=>event.partId===currentSection?.id);
  const completed=partEvents.filter(event=>event.status==="completed");
  const playedParts=reading?.sections.filter(part=>events.some(event=>event.partId===part.id && event.status==="completed")).length || 0;
  const ready=!listening || playedParts===4;
  useEffect(()=>{
    if(audio.pending?.partId && reading){const index=reading.sections.findIndex(part=>part.id===audio.pending?.partId);if(index>=0)setSectionIndex(index);}
  },[audio.pending?.partId,reading]);
  const active = phase === "active" && !round.canRestart && choices !== null;
  const navigable = active && !audioLocked || phase === "feedback";
  const answered = choices ? Object.keys(choices).length : 0;
  const unanswered = questions.length - answered;
  const score = result?.ielts;
  const canonicalAnswer = (values: Record<string, string>) => JSON.stringify(questions.filter(question => values[question.id]).map(question => [question.id, values[question.id]]));

  function choose(questionId: string, optionId?: string) {
    if (!active || !choices) return;
    const next = { ...choices };
    if (optionId) next[questionId] = optionId;
    else delete next[questionId];
    const answer = canonicalAnswer(next);
    if (new TextEncoder().encode(answer).length > 2048) return;
    setConfirmUnanswered(false);
    round.updateDraft(answer);
  }
  function submit() {
    if (!active || !choices || !ready || audioLocked) return;
    if (unanswered && !confirmUnanswered) { setConfirmUnanswered(true); return; }
    setConfirmUnanswered(false);
    void round.submit(canonicalAnswer(choices));
  }
  function startAgain() {
    setSectionIndex(0);
    setConfirmUnanswered(false);
    round.next();
  }

  return <section className={styles.reader} aria-label={`IELTS ${label} practice`}>
    <header className={styles.intro}>
      <span className="eyebrow">{listening ? "LISTENING" : "ACADEMIC READING"} · PRACTICE</span>
      <h1>{reading?.title || (listening ? "Listen, reason, and review" : "Read, reason, and review")}</h1>
      <p>{listening ? "Four original recordings" : "Three original passages"} · 40 questions. Work at your own pace and change your choices before submitting. Your saved result includes the choices you made.</p>
      <p className={styles.note}>A practice band estimate, not an official IELTS score. This practice does not award XP or certify a language level.</p>
      <Link href="/ielts">← Back to IELTS practice</Link>
    </header>

    <LearningRoundNotice round={round} showProgress={false} />
    {attempt && !reading && <p role="alert">This saved practice cannot be displayed. Reload the page to try again.</p>}
    {reading && currentSection && <>
      {choices === null && <div className={styles.warning} role="alert">
        <p>Your saved choices could not be read. They have not been submitted.</p>
        {phase === "active" && <button className="button ghost" onClick={() => round.updateDraft("[]")}>Discard invalid draft</button>}
      </div>}
      {result && score && <section className={styles.result} aria-label={`${label} result`}>
        <div role="status">
          <h2>{label} practice saved</h2>
          <div className={styles.score}><strong>{score.band.toFixed(1)}</strong><span>estimated practice band</span></div>
          <p><b>{score.rawScore}/{score.maxScore} correct</b> · {score.percentage}% · {answered}/{questions.length} answered</p>
        </div>
        <p>Your saved choices were checked against the answer key. Review each question below.</p>
        <p>{score.disclaimer}</p>
        {listening && <p>Playback is reported by your browser. Replays, slow listens and fallback voices are saved as practice assistance, not proof of unaided listening.</p>}
        <details><summary>How this estimate was made</summary>
          <p>{score.method}</p>
          <p>Scoring provider: {score.provider}. Method: {score.methodVersion}.</p>
          <p>Content: {result.contentVersion}. Rules: {result.rulesVersion}. No XP awarded.</p>
        </details>
      </section>}
      <div className={styles.progress}>
        <strong>{answered}/{questions.length} answered</strong><span>{unanswered} unanswered</span>
        <progress aria-label="Questions answered" value={answered} max={questions.length} />
      </div>
      <nav className={styles.parts} data-listening={listening} aria-label={`${label} parts`}>
        {reading.sections.map((section, index) => <button key={section.id} type="button" aria-label={`Part ${index + 1}`}
          aria-current={currentSection.id === section.id ? "step" : undefined} disabled={!navigable}
          onClick={() => { setSectionIndex(index); setConfirmUnanswered(false); }}>
          <b>Part {index + 1}</b><span>{section.questions.filter(question => choices?.[question.id]).length}/{section.questions.length} answered</span>
          {listening && <span>{events.some(event=>event.partId===section.id && event.status==="completed") ? "Listened" : "Listen to this part"}</span>}
        </button>)}
      </nav>
      <div className={styles.layout}>
        {listening ? <aside className={styles.passage} aria-label="Part audio">
          <h2>{currentSection.title}</h2>
          {!result && <>
            <p>You can answer while listening. Finish all four recordings before saving. Replays and slow listens are recorded.</p>
            {phase==="active" && <div className={styles.footer}>
              {audio.corrupt ? <button className="button ghost" onClick={audio.discardInvalid}>Discard invalid audio reference</button>
                : audio.pending && audio.phase==="idle" ? <button className="button primary" onClick={()=>void audio.play()}>Retry audio request</button>
                : <><button className="button primary" disabled={audio.phase!=="idle" || !active} onClick={()=>void audio.play(1)}>{completed.length ? "Replay recording" : "Play recording"}</button>
                  <button className="button ghost" disabled={audio.phase!=="idle" || !active} onClick={()=>void audio.play(.72)}>Listen slowly · 0.72×</button></>}
              {audio.phase!=="idle" && <button className="button ghost" onClick={audio.stop} disabled={audio.phase==="saving"}>Stop audio</button>}
            </div>}
            <p role="status">{audio.phase==="loading" ? "Preparing audio…" : audio.phase==="playing" ? "Playing — listen to the end…" : audio.phase==="saving" ? "Confirming playback…" : audio.message || "Your choices stay saved as you work."}</p>
            {audio.warning && <p role="alert">{audio.warning}</p>}
          </>}
          <p>{completed.length} completed · {Math.max(0,completed.length-1)} replays · {completed.filter(event=>event.rate<1).length} slow listens · {partEvents.filter(event=>event.status==="failed").length} failed</p>
          {(audio.provider==="browser-speech-synthesis" || partEvents.some(event=>event.provider==="browser-speech-synthesis")) && <p className={styles.note}>Using your browser’s English voice. Its text is supplied for playback; this is assisted practice.</p>}
          {result && <details><summary>Review recording transcript</summary><p>{result.listening?.transcripts?.[currentSection.id]}</p></details>}
        </aside> : <article className={styles.passage} aria-label="Reading passage">
          <h2>{currentSection.title}</h2>
          {(currentSection.passage || "").split("\n\n").map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </article>}
        <div className={styles.questions}>
          {currentSection.questions.map(question => {
            const number = questions.findIndex(item => item.id === question.id) + 1;
            const review = score?.answers.find(answer => answer.questionId === question.id);
            const actualId = review?.optionId ?? choices?.[question.id];
            const actualText = question.options.find(option => option.id === actualId)?.text || "Unanswered";
            const correctText = question.options.find(option => option.id === review?.correctOptionId)?.text;
            return <fieldset className={styles.question} key={question.id}>
              <legend>{number}. {question.prompt}</legend>
              <div className={styles.options}>
                {question.options.map(option => <label key={option.id} data-selected={actualId === option.id}
                  data-verdict={review ? option.id === review.correctOptionId ? "correct" : option.id === actualId ? "incorrect" : undefined : undefined}>
                  <input type="radio" name={`${kind}-${attempt?.attemptId}-${question.id}`} value={option.id}
                    checked={actualId === option.id} disabled={!active}
                    onChange={() => choose(question.id, option.id)} />
                  <span>{option.text}</span>
                </label>)}
              </div>
              {!result && <button type="button" className={styles.clear} disabled={!active || !choices?.[question.id]}
                aria-label={`Clear answer for question ${number}`} onClick={() => choose(question.id)}>Clear choice</button>}
              {review && <div className={styles.review} data-correct={review.correct}>
                <strong>{review.correct ? "Correct" : actualId ? "Needs another look" : "Not answered"}</strong>
                <p>Your answer: {actualText}</p><p>Correct answer: {correctText}</p>
              </div>}
            </fieldset>;
          })}
        </div>
      </div>
      {listening && !result && <p role="status">{playedParts}/4 parts listened to completion. {ready ? "You can save your choices." : "Listen to every part before saving."}</p>}
      <footer className={styles.footer}>
        <button type="button" className="button ghost" disabled={!navigable || sectionIndex === 0} onClick={() => setSectionIndex(index => index - 1)}>← Previous part</button>
        {sectionIndex < reading.sections.length - 1 && <button type="button" className="button ghost" disabled={!navigable} onClick={() => setSectionIndex(index => index + 1)}>Next part →</button>}
        {!result ? <button type="button" className="button primary" disabled={!active || !ready || audioLocked} onClick={submit}>Submit choices</button>
          : <button type="button" className="button primary" disabled={phase !== "feedback"} onClick={startAgain}>Start another {label} practice</button>}
      </footer>
      {confirmUnanswered && active && <div className={styles.warning} role="group" aria-label="Confirm unanswered questions">
        <p><b>{unanswered} questions are unanswered.</b> They will count as incorrect. Once saved, this result cannot be changed.</p>
        <div className={styles.footer}>
          <button type="button" className="button ghost" onClick={() => setConfirmUnanswered(false)}>Keep answering</button>
          <button type="button" className="button primary" onClick={submit}>Submit with unanswered questions</button>
        </div>
      </div>}
    </>}
  </section>;
}
