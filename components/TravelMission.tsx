"use client";

import Link from "next/link";
import { missionConfigs, type MissionScenario } from "@/data/missionConfigs";
import useMissionConversation from "./learning/useMissionConversation";
import styles from "./learning/MissionConversation.module.css";

export default function TravelMission({ scenario }: { scenario: MissionScenario }) {
  const config = missionConfigs[scenario], game = useMissionConversation(config.bossId);
  const { boss, draft, verdict, receipt, busy } = game;
  const checkpoints = boss?.checkpoints || [], won = !!boss?.cleared;
  const ready = checkpoints.filter(c => c.complete).length;
  const progress = checkpoints.length ? Math.round((ready + (won ? 1 : (verdict?.stage || 0) / 3)) / (checkpoints.length + 1) * 100) : 0;
  return <div className={`mission-shell ${styles.shell}`}>
    <section className="mission-header"><div><span className="eyebrow light">{config.eyebrow}</span><h1>{config.title}</h1><p>{config.copy}</p></div><div className="mission-progress"><strong>{progress}%</strong><small>chapter</small></div></section>
    {game.error && <p role="alert" className="feedback-banner">{game.error}</p>}
    {game.storageWarning && <p role="status">{game.storageWarning}</p>}
    {!game.signedIn && !busy && <p>Sign in to keep your mission dialogue and chapter rewards. <Link href="/account">Open account →</Link></p>}
    <div className="mission-stage-grid">{checkpoints.map((stage, i) => <article className={`mission-stage ${stage.complete ? "complete" : ""}`} key={stage.id}>
      <span>0{i + 1}</span><div><small>{stage.skill}</small><strong>{stage.title}</strong></div><div className="mission-stage-actions"><Link href={stage.route}>{stage.complete ? "Practise again ↗" : "Earn evidence ↗"}</Link><b>{stage.complete ? "✓ READY" : "NOT READY"}</b></div>
    </article>)}</div>
    {busy && !boss && <p role="status">Loading your mission…</p>}
    {game.signedIn && <section className="npc-panel" aria-label="Mission conversation">
      <div className="npc-panel-head"><div><span className="npc-avatar">✦</span><div><small>GUIDED ROLE-PLAY</small><strong>{config.agent}</strong></div></div><span className="mode-badge">{won ? "CHAPTER CLEARED" : boss?.unlocked ? `OBJECTIVES ${verdict?.stage || 0}/3` : "GATE LOCKED"}</span></div>
      <p className={styles.explanation}>Replies are checked against an ordered practice rubric. This is not a fluency or pronunciation score. Chat turns do not award learning XP.</p>
      {boss && !boss.unlocked && !won ? <div className="npc-lock"><strong>Complete the chapter checkpoints to enter this role-play.</strong><p>Later chapters require fresh practice after the previous chapter.</p></div> : <>
        <div className="objective-box" aria-live="polite"><small>{won ? "SAVED COMPLETION" : "CURRENT OBJECTIVE"}</small><strong>{won ? "This chapter is complete." : verdict?.missing[0] || (verdict?.complete ? "All three objectives addressed. Save your chapter." : config.objective)}</strong></div>
        <div className={`chat-log ${styles.log}`}>{draft.messages.map((text, i) => <div key={i}>
          <div className="chat-bubble user"><span>You · {i + 1}</span><p>{text}</p></div>
          {verdict?.turns[i] && <div className="chat-bubble agent"><span>{verdict.turns[i].accepted ? "✓ Objective addressed" : "Try a clearer reply"}</span><p>{verdict.turns[i].feedback}</p></div>}
        </div>)}</div>
        {!won && <p className={styles.reply}>{verdict?.reply || config.intro}</p>}
        {won ? <div className="boss-win"><div><strong>Chapter reward saved · {boss?.rewardXp} XP</strong><p>{config.reward}</p>
          {receipt ? <p>{receipt.legacy ? "This earlier completion has no saved dialogue evidence." : "Your submitted dialogue and rule-based result are saved to your account."}</p> : <p role="status">{busy ? "Loading your saved dialogue…" : "Your chapter is complete, but its saved dialogue could not be loaded."}</p>}
        </div><Link href={config.campaignRoute} className="button primary">Continue campaign →</Link></div> : boss?.unlocked && <>
          <form className={styles.form} onSubmit={e => { e.preventDefault(); game.send(); }}>
            <label htmlFor="mission-reply">Your reply</label>
            <textarea id="mission-reply" value={draft.text} onChange={e => game.edit(e.target.value)} maxLength={1024} disabled={busy || !!draft.pending || !!verdict?.complete || game.brokenDraft} placeholder="Respond to the current objective in English…" />
            <button className="button primary" disabled={busy || !!draft.pending || !!verdict?.complete || game.brokenDraft || !draft.text.trim() || draft.messages.length >= 24}>Send reply →</button>
          </form>
          <p>{draft.messages.length}/24 turns · One objective per reply</p>
          {verdict?.complete && !draft.pending && <button className="button primary" disabled={busy} onClick={game.claim}>Save chapter completion</button>}
          {draft.pending && <button className="button primary" disabled={busy} onClick={game.retry}>{busy ? "Saving…" : draft.pending === "claim" ? "Retry same completion" : "Retry same reply"}</button>}
          <div className={styles.actions}><button className="button" disabled={busy || draft.pending === "claim"} onClick={game.restart}>Restart dialogue</button><button className="button" disabled={busy} onClick={() => void game.reload()}>Reload saved state</button></div>
        </>}
      </>}
      {!boss && game.error && <button className="button" disabled={busy} onClick={() => void game.reload()}>Retry loading mission</button>}
      {won && !receipt && game.error && <button className="button" disabled={busy} onClick={() => void game.reload()}>Retry loading saved completion</button>}
    </section>}
  </div>;
}
