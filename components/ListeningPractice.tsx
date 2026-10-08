"use client";

import useVerifiedLearningRound from "./learning/useVerifiedLearningRound";
import useListeningPlayback from "./learning/useListeningPlayback";
import LearningRoundNotice from "./learning/LearningRoundNotice";
import styles from "./learning/VerifiedListening.module.css";

const labels:Record<string,string>={"cefr-core":"Everyday details","travel-airport":"TRAVEL · AIRPORT","travel-transit":"TRAVEL · TRANSIT","conversation-cafe":"CONVERSATION · CAFE","conversation-plans":"CONVERSATION · MAKE PLANS","work-requirements":"WORK · REQUIREMENTS"};
export default function ListeningPractice({pack="default"}:{pack?:string}) {
 const routePack=pack==="default" || !pack ? "cefr-core" : pack;
 const round=useVerifiedLearningRound("listen-pick",routePack,"B1",3);
 const audio=useListeningPlayback(round);
 const {attempt,result,phase,selected,context}=round;
 const events=attempt?.listening?.events || [], completed=events.filter(e=>e.status==="completed"), slow=completed.filter(e=>e.rate<1).length;
 const busy=audio.phase!=="idle", ready=completed.length>0 && !audio.pending && !busy;
 return <section className={styles.card} aria-label="Listening practice">
  <div className={styles.toolbar}><span>{labels[routePack] || "Listening pack"} · B1</span><b>Round {context.round+1}/3</b><span>{attempt?.mode==="account"?`${round.score} XP this set`:"Guest practice"}</span></div>
  <progress aria-label="Set progress" max={3} value={context.round+Number(!!result)} />
  <LearningRoundNotice round={round}/>
  {attempt && <>
   <div className={styles.audio}>
    <span className={styles.icon} aria-hidden="true">♫</span>
    <div><h2>Catch the important detail</h2><p>Listen to the whole clip, then choose. You can replay or slow it down.</p></div>
    {phase==="active" && <div className={styles.controls}>
     {audio.pending && !busy ? <button onClick={()=>void audio.play()}>Retry audio request</button> : <>
      <button disabled={busy} onClick={()=>void audio.play(1)}>{completed.length?"Replay audio":"Play audio"}</button>
      <button disabled={busy} onClick={()=>void audio.play(.72)}>Listen slowly · 0.72×</button>
     </>}
     {busy && <button onClick={audio.stop} disabled={audio.phase==="saving"}>Stop audio</button>}
    </div>}
    <p role="status" className={styles.status}>{audio.phase==="loading"?"Preparing audio…":audio.phase==="playing"?"Playing — listen to the end…":audio.phase==="saving"?"Confirming playback…":audio.message || (completed.length?"Playback restored. You can answer or listen again.":"Play the clip to unlock the choices.")}</p>
    {audio.warning && <p role="alert">{audio.warning}</p>}
    {audio.message && !busy && !ready && phase==="active" && <button className={styles.reset} onClick={round.restart}>Start a new listening set</button>}
    <p className={styles.caption}>{completed.length} completed · {Math.max(0,completed.length-1)} replays · {slow} slow listens · {events.filter(e=>e.status==="failed").length} failed</p>
    {events.some(e=>e.provider==="browser-speech-synthesis") && <p className={styles.caption}>Using your browser&apos;s English voice.</p>}
   </div>
   <h2 id="listening-question">{attempt.prompt.question}</h2>
   <div className={styles.options} role="group" aria-labelledby="listening-question">
    {attempt.prompt.options.map(option=><button key={option} disabled={phase!=="active" || !ready} aria-pressed={selected===option}
     data-verdict={result?option===result.correctAnswer?"correct":selected===option?"wrong":"other":undefined}
     onClick={()=>void round.submit(option)}>{option}</button>)}
   </div>
   {result && phase==="feedback" && <div className={styles.feedback}>
    <div role="status"><strong>{result.correct?"✓ Detail understood":"Listen for this detail"}</strong>
     <p>Your choice: {result.actualAnswer}</p><p><b>Best answer:</b> {result.correctAnswer}</p>
     <blockquote>{result.listening?.transcript}</blockquote><p>{result.feedback}</p>
     {result.reviewAdded && <p>The clip transcript and question were added to your review queue.</p>}
    </div>
    <button className="button primary" onClick={round.next}>{context.round===2?"Play another set":"Next clip →"}</button>
   </div>}
  </>}
  <p className={styles.caption}>Guided listening practice. Listen at your own pace; replays and slow listening are saved with this round.</p>
 </section>;
}
