"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { type CEFRLevel } from "@/lib/learning-attempt";
import useVerifiedLearningRound from "@/components/learning/useVerifiedLearningRound";
import LearningRoundNotice from "@/components/learning/LearningRoundNotice";

const LEVELS: CEFRLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"], ROUNDS = 5;
export default function WordLinkGame() {
  return <Suspense fallback={<p role="status">Opening Word Link…</p>}><WordLinkEntry /></Suspense>;
}
function WordLinkEntry() {
  const query = useSearchParams(), pack = query.get("pack") === "travel-airport" ? "travel-airport" : "cefr-core";
  return <WordLinkRound key={pack} pack={pack} challenge={!!query.get("challenge")} />;
}
function WordLinkRound({ pack, challenge }: { pack: string; challenge: boolean }) {
  const verified = useVerifiedLearningRound("word-link", pack, pack === "travel-airport" ? "B1" : "A1", ROUNDS);
  const { attempt, result, selected, phase, context, score, streak } = verified;
  const progress = (context.round + Number(!!result)) / ROUNDS * 100;
  return <div className="play-shell">
    {challenge && <div className="challenge-banner">Practice duel · leaderboard submission is paused while ranked scoring is being updated.</div>}
    <div className="play-top"><div><span className="eyebrow">WORD LINK · {context.pack === "travel-airport" ? "TRAVEL · AIRPORT" : "VOCABULARY"}</span><strong>Round {context.round + 1}/{ROUNDS}</strong></div>
      <label className="mode-badge">CEFR <select aria-label="CEFR level" value={context.level} disabled={!verified.canChangeLevel} onChange={e => verified.changeLevel(e.target.value as CEFRLevel)}>{LEVELS.map(level => <option key={level}>{level}</option>)}</select></label>
      <div className="play-score"><span>🔥 {streak}</span><b>{attempt?.mode === "guest" ? "Guest practice" : `${score} XP this set`}</b></div>
    </div>
    <div className="progress large"><i style={{ width: `${progress}%` }} /></div>
    <LearningRoundNotice round={verified} />
    {attempt && <section className="word-game-card">
      <p className="prompt-label">{attempt.cefrLevel} · {attempt.prompt.relation}</p>
      <div className="word-link-arena"><div className="core-word"><small>CORE WORD</small><strong>{attempt.prompt.word}</strong><span>choose the best connection</span></div>
        <div className="option-grid">{attempt.prompt.options.map(option => {
          const state = result ? option === result.correctAnswer ? "correct" : option === selected ? "wrong" : "muted" : selected === option ? "muted" : "";
          return <button key={option} disabled={phase !== "active"} aria-pressed={selected === option} className={`word-option ${state}`} onClick={() => void verified.submit(option)}><span className="link-dot">•</span>{option}</button>;
        })}</div>
      </div>
      {result && phase === "feedback" && <div className={`feedback-box ${result.correct ? "success" : "error"}`}><div>
        <strong>{result.correct ? "Connection verified ✓" : `Not quite — ${result.correctAnswer}`}</strong>
        <p>{result.feedback} {result.reviewAdded && "This item was added to your adaptive review queue."}</p>
      </div><button className="button primary" onClick={verified.next}>{context.round === ROUNDS - 1 ? "Play another set" : "Next verified link →"}</button></div>}
    </section>}
  </div>;
}
