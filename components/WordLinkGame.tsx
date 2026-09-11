"use client";

import { useMemo, useState } from "react";

const rounds = [
  { word: "significant", relation: "Choose the closest synonym", answer: "substantial", options: ["minor", "substantial", "temporary", "ordinary"], note: "Significant and substantial can both describe something large or important in degree." },
  { word: "increase", relation: "Choose a natural collocation", answer: "increase dramatically", options: ["increase loudly", "increase dramatically", "increase politely", "increase softly"], note: "Dramatically is a common adverb used to describe a large or sudden increase." },
  { word: "scarce", relation: "Choose the antonym", answer: "abundant", options: ["rare", "limited", "abundant", "insufficient"], note: "Scarce means not enough is available; abundant means plentiful." },
  { word: "benefit", relation: "Choose the strongest word-family link", answer: "beneficial", options: ["beneficial", "beautiful", "beneath", "belief"], note: "Beneficial is the adjective form related to the noun and verb benefit." },
  { word: "allocate", relation: "Choose the best meaning", answer: "distribute for a purpose", options: ["remove completely", "distribute for a purpose", "speak uncertainly", "compare two objects"], note: "To allocate means to assign or distribute resources for a particular purpose." },
];

export default function WordLinkGame() {
  const [round, setRound] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const current = rounds[round];
  const isCorrect = selected === current.answer;
  const progress = ((round + (selected ? 1 : 0)) / rounds.length) * 100;
  const completed = round === rounds.length - 1 && selected !== null;

  const shuffled = useMemo(() => current.options, [current]);

  function choose(option: string) {
    if (selected) return;
    setSelected(option);
    if (option === current.answer) {
      setScore((value) => value + 20 + streak * 2);
      setStreak((value) => value + 1);
    } else {
      setStreak(0);
    }
  }

  function next() {
    if (round >= rounds.length - 1) {
      setRound(0); setSelected(null); setScore(0); setStreak(0); return;
    }
    setRound((value) => value + 1);
    setSelected(null);
  }

  return (
    <div className="play-shell">
      <div className="play-top"><div><span className="eyebrow">WORD LINK · TRAVEL ROUTE</span><strong>Round {round + 1}/{rounds.length}</strong></div><div className="play-score"><span>🔥 {streak}</span><b>{score} XP</b></div></div>
      <div className="progress large"><i style={{ width: `${progress}%` }} /></div>

      <section className="word-game-card">
        <p className="prompt-label">{current.relation}</p>
        <div className="word-link-arena">
          <div className="core-word"><small>CORE WORD</small><strong>{current.word}</strong><span>tap the best connection</span></div>
          <div className="option-grid">
            {shuffled.map((option) => {
              const state = selected ? option === current.answer ? "correct" : option === selected ? "wrong" : "muted" : "";
              return <button key={option} className={`word-option ${state}`} onClick={() => choose(option)}><span className="link-dot">•</span>{option}</button>;
            })}
          </div>
        </div>

        {selected && <div className={`feedback-box ${isCorrect ? "success" : "error"}`}><div><strong>{isCorrect ? "Connection found ✓" : `Not quite — ${current.answer}`}</strong><p>{current.note}</p></div><button className="button primary" onClick={next}>{completed ? "Play again" : "Next link →"}</button></div>}
      </section>
    </div>
  );
}
