"use client";

import { type CEFRLevel } from "@/lib/learning-attempt";
import useVerifiedLearningRound from "./useVerifiedLearningRound";
import LearningRoundNotice from "./LearningRoundNotice";

const LEVELS: CEFRLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
const campaignLevels: Record<string, CEFRLevel> = {
  "travel-transit": "A2",
  "conversation-cafe": "A2",
  "conversation-clarity": "B1",
  "work-standup": "B1",
  "work-deadline": "B2",
};
const campaignLabels: Record<string, string> = {
  "travel-transit": "TRAVEL · TRANSIT",
  "conversation-cafe": "CONVERSATION · CAFE",
  "conversation-clarity": "CONVERSATION · CLARITY",
  "work-standup": "WORK · STAND-UP",
  "work-deadline": "WORK · DEADLINE",
};

export default function VerifiedCollocationFactory({ pack = "default" }: { pack?: string }) {
  const normalized = pack === "cefr-core" || campaignLevels[pack] ? pack : "cefr-core";
  return <CollocationRound key={normalized} pack={normalized} />;
}

function CollocationRound({ pack }: { pack: string }) {
  const verified = useVerifiedLearningRound("collocation-factory", pack, campaignLevels[pack] || "A1", 3);
  const { attempt, result, selected, phase, context, score } = verified;
  const campaign = context.pack !== "cefr-core";
  const label = campaign ? campaignLabels[context.pack] || context.pack.replaceAll("-", " ").toUpperCase() : "A1 → C2";

  return <section className="mini-card factory">
    <div className="mini-head"><span className="eyebrow">COLLOCATION FACTORY · {label}</span><b>Round {context.round + 1}/3</b></div>
    <div className="factory-toolbar" aria-live="polite">
      {!campaign ? <label>CEFR <select aria-label="Collocation CEFR level" value={context.level} disabled={phase === "submitting" || phase === "loading"} onChange={e => verified.changeLevel(e.target.value as CEFRLevel)}>{LEVELS.map(level => <option key={level}>{level}</option>)}</select></label> : <span>{context.level} campaign practice</span>}
      <strong>{attempt?.mode === "guest" ? "Guest practice" : `${score} XP this set`}</strong>
    </div>
    <LearningRoundNotice round={verified} />
    {attempt && <>
      <div className="factory-core"><small>{attempt.cefrLevel} · {attempt.prompt.relation}</small><strong>{attempt.prompt.word} + ?</strong></div>
      <div className="factory-options">{attempt.prompt.options.map(option => {
        const state = result ? option === result.correctAnswer ? "correct" : option === selected ? "wrong" : "muted" : selected === option ? "muted" : "";
        return <button key={option} disabled={phase !== "active"} aria-pressed={selected === option} className={state} onClick={() => void verified.submit(option)}>{option}</button>;
      })}</div>
      {result && phase === "feedback" && <div className={`mini-feedback-box ${result.correct ? "success" : "error"}`}>
        <span>{result.correct ? "✓ Natural pair" : "Review this collocation"}</span><strong>{result.correctAnswer}</strong><p>{result.feedback}</p>
        <button className="button primary" onClick={verified.next}>{context.round === 2 ? "Play another set" : "Next collocation →"}</button>
      </div>}
    </>}
  </section>;
}
