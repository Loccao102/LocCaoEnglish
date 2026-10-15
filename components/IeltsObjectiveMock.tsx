"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { IELTSSection } from "@/data/ieltsMocks";
import { type ObjectiveScore, scoreObjective } from "@/lib/ielts";
import { getAuthToken } from "@/lib/session";
import { synthesizeSpeech } from "@/lib/tts";
import { playListeningClip } from "@/lib/listening-audio";
import type { ListeningAudio } from "@/lib/learning-attempt";
import useSignedInToken from "./learning/useSignedInToken";
import styles from "./IeltsObjectiveMock.module.css";

// Only Listening remains on this legacy, client-scored path. Reading has its
// own server-issued attempt adapter and cannot call the tally endpoint.
export default function IeltsObjectiveMock({ kind, sections }: { kind: "listening"; sections: IELTSSection[] }) {
  const token = useSignedInToken();
  if (token === null) return <p role="status">Loading your account…</p>;
  if (!token) return <section className={styles.mock}>
    <h1>Sign in to save your Listening estimate</h1>
    <p>This practice currently saves a score reported by your browser. It does not verify or store your original answers on the server.</p>
    <Link className="button primary" href="/account">Sign in</Link>
  </section>;
  return <ListeningMock key={token} kind={kind} sections={sections} token={token} />;
}

function ListeningMock({ kind, sections, token }: { kind: "listening"; sections: IELTSSection[]; token: string }) {
  const [sectionIndex, setSectionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ObjectiveScore | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [played, setPlayed] = useState<Record<number, boolean>>({});
  const [audioBusy, setAudioBusy] = useState(false);
  const [audioMessage, setAudioMessage] = useState("");
  const playback = useRef<AbortController | null>(null);
  const section = sections[sectionIndex];
  const questions = useMemo(() => sections.flatMap(item => item.questions), [sections]);
  const answered = Object.keys(answers).length;
  const correct = questions.filter(question => answers[question.id] === question.answer).length;
  const locked = busy || !!result;

  useEffect(() => {
    const hidden = () => { if (document.hidden) playback.current?.abort(); };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      playback.current?.abort();
      playback.current = null;
    };
  }, []);

  async function play() {
    if (played[sectionIndex] || playback.current || busy || document.hidden || token !== getAuthToken()) return;
    const part = sectionIndex;
    const controller = new AbortController();
    playback.current = controller;
    const current = () => playback.current === controller && token === getAuthToken();
    setAudioBusy(true); setAudioMessage("Preparing the recording…");
    try {
      let clip: ListeningAudio = { provider: "browser-speech-synthesis", text: section.context, rate: .94 };
      try {
        const speech = await synthesizeSpeech(section.context, .94, "en-US-JennyNeural", controller.signal);
        if (speech.provider === "azure-speech-neural-tts" && speech.audioBase64 && speech.mimeType === "audio/mpeg") {
          clip = { provider: "azure-speech-neural-tts", audioBase64: speech.audioBase64, mimeType: speech.mimeType, rate: .94 };
        }
      } catch (reason) {
        if (controller.signal.aborted) throw reason;
        // This remains client-reported listening; disclose the local fallback.
      }
      if (!current()) return;
      setAudioMessage(clip.provider === "browser-speech-synthesis" ? "Playing with your browser's English voice…" : "Playing the recording…");
      // These full passages exceed the short-exercise player's 90-second budget.
      await playListeningClip(clip, controller.signal, 300000);
      if (!current()) return;
      setPlayed(previous => ({ ...previous, [part]: true }));
      setAudioMessage("Recording finished. You can answer the questions.");
    } catch {
      if (current()) setAudioMessage("The recording did not finish. Try playing it again.");
    } finally {
      if (current()) { playback.current = null; setAudioBusy(false); }
    }
  }
  async function submit() {
    if (locked || token !== getAuthToken()) return;
    setBusy(true); setError("");
    try {
      const response = await scoreObjective(kind, correct, questions.length, "academic", token);
      if (token === getAuthToken()) setResult(response.result);
    } catch (reason) {
      if (token === getAuthToken()) setError(reason instanceof Error ? reason.message : "The estimate could not be saved. Your choices are still here.");
    } finally { if (token === getAuthToken()) setBusy(false); }
  }
  function reset() {
    if (busy || audioBusy) return;
    setAnswers({}); setResult(null); setSectionIndex(0); setPlayed({});
    setAudioMessage(""); setError(""); setReviewing(false);
  }

  return <section className={styles.mock} aria-label="IELTS Listening practice">
    <header className={styles.intro}>
      <span className="eyebrow">IELTS LISTENING · PRACTICE</span>
      <h1>{result && !reviewing ? "Listening estimate saved" : section.title}</h1>
      <p>Client-reported practice estimate: your browser checks these answers and sends the score. The server does not verify or save the original choices. This is not an official IELTS score.</p>
      <Link href="/ielts">← Back to IELTS practice</Link>
    </header>
    {error && <div className={styles.error} role="alert"><p>{error}</p><p>Your choices are still here. Check your connection or sign in again before retrying.</p></div>}
    {audioMessage && <p role="status">{audioMessage}</p>}
    {result && <div className={styles.result} role="status">
      <h2>Client-reported Listening estimate</h2>
      <strong>{result.band.toFixed(1)} <small>estimated practice band</small></strong>
      <p>{result.rawScore}/{result.maxScore} reported correct · {result.percentage}% · {answered}/{questions.length} answered</p>
      <p>{result.disclaimer}</p>
      <div className={styles.actions}>
        <button className="button ghost" onClick={() => setReviewing(value => !value)}>{reviewing ? "Hide answers" : "Review answers"}</button>
        <button className="button primary" disabled={audioBusy} onClick={reset}>Start again</button>
      </div>
    </div>}
    {(!result || reviewing) && <>
      <div className={styles.parts} aria-label="Listening parts">
        {sections.map((part, index) => <button key={part.title} className={index === sectionIndex ? styles.selected : undefined}
          disabled={busy || audioBusy} aria-current={index === sectionIndex ? "step" : undefined}
          onClick={() => { setSectionIndex(index); setAudioMessage(""); }}>Part {index + 1}<span>{part.questions.filter(question => answers[question.id]).length}/{part.questions.length}</span></button>)}
      </div>
      {!result && <div className={styles.audio}>
        <button className="button primary" disabled={!!played[sectionIndex] || audioBusy || busy} onClick={() => void play()}>
          {audioBusy ? "Playing…" : played[sectionIndex] ? "Recording played" : "Play recording"}
        </button>
        <p>Listen once, then answer. The passage script stays hidden. Failed playback can be retried.</p>
      </div>}
      <div className={styles.questions}>
        {section.questions.map(item => <fieldset key={item.id}>
          <legend>{questions.findIndex(question => question.id === item.id) + 1}. {item.prompt}</legend>
          <div className={styles.options}>
            {item.options.map(option => <label key={option} data-selected={answers[item.id] === option}>
              <input type="radio" name={`listening-${item.id}`} disabled={locked} checked={answers[item.id] === option}
                onChange={() => setAnswers(previous => ({ ...previous, [item.id]: option }))} />
              <span>{option}</span>
            </label>)}
          </div>
          {result && <p>Correct answer: {item.answer}</p>}
        </fieldset>)}
      </div>
      <footer className={styles.actions}>
        <button className="button ghost" disabled={sectionIndex === 0 || busy || audioBusy} onClick={() => setSectionIndex(value => value - 1)}>← Previous</button>
        <span>{questions.length - answered} unanswered</span>
        {sectionIndex < sections.length - 1 ? <button className="button primary" disabled={busy || audioBusy} onClick={() => setSectionIndex(value => value + 1)}>Next section →</button>
          : !result && <button className="button primary" disabled={busy || audioBusy} onClick={() => void submit()}>{busy ? "Saving estimate…" : "Save reported estimate"}</button>}
      </footer>
    </>}
  </section>;
}
