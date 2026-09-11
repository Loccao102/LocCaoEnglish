"use client";

import { useMemo, useState } from "react";

const lines = [
  "Would you like to have a cup of coffee?",
  "I've been trying to cut down on caffeine lately.",
  "The flight has been delayed due to severe weather conditions.",
  "Although public transport is convenient, it can become overcrowded during rush hour.",
  "Governments should allocate more resources to improve access to higher education.",
];

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9' ]/g, "").replace(/\s+/g, " ").trim();

export default function DictationTrainer() {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState(false);
  const current = lines[index];

  const accuracy = useMemo(() => {
    if (!checked) return 0;
    const expected = normalize(current).split(" ");
    const actual = normalize(answer).split(" ");
    let matched = 0;
    expected.forEach((word, i) => { if (actual[i] === word) matched += 1; });
    return Math.round((matched / expected.length) * 100);
  }, [answer, checked, current]);

  function speak(rate = 0.88) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(current);
    utterance.lang = "en-US";
    utterance.rate = rate;
    window.speechSynthesis.speak(utterance);
  }

  function next() {
    setIndex((value) => (value + 1) % lines.length);
    setAnswer(""); setChecked(false);
  }

  return (
    <section className="trainer-card">
      <div className="trainer-toolbar"><span className="level-chip">Level {index + 1}</span><span>{index + 1} / {lines.length}</span></div>
      <div className="audio-orb"><button onClick={() => speak()} aria-label="Play sentence">▶</button><div><strong>Listen to the sentence</strong><small>Natural speed · US English browser voice</small></div><button className="speed-button" onClick={() => speak(0.65)}>0.65×</button></div>
      <label className="answer-label" htmlFor="dictation-answer">Type exactly what you hear</label>
      <textarea id="dictation-answer" className="practice-textarea short" value={answer} onChange={(e) => { setAnswer(e.target.value); setChecked(false); }} placeholder="Start typing here…" />
      {!checked ? <button className="button primary wide" onClick={() => setChecked(true)} disabled={!answer.trim()}>Check answer</button> : <div className={`dictation-result ${accuracy >= 80 ? "success" : "error"}`}><div className="accuracy-ring"><strong>{accuracy}%</strong><small>accuracy</small></div><div><strong>{accuracy === 100 ? "Perfect dictation." : accuracy >= 80 ? "Very close." : "Add this line to your review queue."}</strong><p>{current}</p></div><button className="button primary" onClick={next}>Next →</button></div>}
    </section>
  );
}
