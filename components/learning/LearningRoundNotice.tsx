import Link from "next/link";
import type useVerifiedLearningRound from "./useVerifiedLearningRound";

export default function LearningRoundNotice({ round }: { round: ReturnType<typeof useVerifiedLearningRound> }) {
  const { phase, message, storageWarning, canRestart, result, attempt } = round;
  return <>
    {storageWarning && <p role="status">{storageWarning}</p>}
    {phase === "loading" && <p role="status">Opening your round…</p>}
    {phase === "submitting" && <p role="status">Checking your answer…</p>}
    {(phase === "load-error" || phase === "submit-error") && <div className="feedback-box error" role="alert"><div><strong>{phase === "load-error" ? "Round could not load" : "Answer not confirmed yet"}</strong><p>{message}</p></div><button className="button primary" onClick={canRestart ? round.restart : round.retry}>{canRestart ? "Start a new round" : phase === "submit-error" ? "Retry same answer" : "Retry same request"}</button></div>}
    {attempt && <p className="game-caption">{attempt.mode === "guest" ? <>Guest practice · no account XP. <Link href="/account">Sign in to keep progress →</Link></> : result ? result.progressionApplied ? `+${result.xpDelta} XP · Progress saved.` : "Practice saved. This question already counted toward your progress today." : "Each question counts toward progress once per UTC day. You can keep practising."}</p>}
  </>;
}
