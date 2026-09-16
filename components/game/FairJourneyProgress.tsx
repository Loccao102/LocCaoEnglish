"use client";

import Link from "next/link";
import { courseById, courseProgress, courseReplayGoal, courseUnlocked } from "@/lib/game/fair-courses";
import { fairRunHref } from "@/lib/game/fair-continuation";
import { festivalById } from "@/lib/game/festival";
import { useFairProgress } from "./FairProgressProvider";
import { useFairCheckpoints } from "./useFairCheckpoints";

export default function FairJourneyProgress({showAtlas=true}:{showAtlas?:boolean}) {
  const fair=useFairProgress(),runs=useFairCheckpoints();
  const legacy=!!fair.save.games["cloud-hop"]?.visits;
  const resumable=runs.filter(item=>!item.run.courseId||courseUnlocked(item.run.courseId,fair.courses,legacy));
  const latest=resumable.filter((item,index)=>resumable.findIndex(other=>other.run.gameId===item.run.gameId)===index).slice(0,3);
  const atlas=courseProgress("cloud-hop",fair.courses,legacy),next=atlas.next;
  if(fair.status!=="ready")return null;
  return <div className="fair-journey-progress">
    {latest.length>0&&<section className="fair-resume-section" aria-label="Games to continue"><h2>A little adventure is waiting.</h2><p>Your unfinished games on this device.</p><div className="fair-resume-grid">{latest.map(saved=>{
      const game=festivalById(saved.run.gameId)!,course=courseById(saved.run.courseId);
      return <Link key={game.id} href={fairRunHref(saved.run)} aria-label={`Continue ${game.name}${course?`: ${course.name}`:""}`}>
        <span>{game.name}{course&&` · ${course.name}`}</span><strong>{saved.session.state.phase==="win"?"Save your finished result":`Round ${saved.session.state.round+1} of ${game.rounds}`}</strong><small>{saved.session.state.hearts} hearts · continue →</small>
      </Link>;
    })}</div></section>}
    {showAtlas&&next&&<section className="journey-sky-atlas" aria-label="Sky atlas journey"><div><span className="eyebrow">MÂY’S SKY ATLAS</span><h2>{atlas.completed===atlas.courses.length?"Every trail leads home.":"Help Mây draw a path home."}</h2><p>{atlas.medals===atlas.totalMedals?"Every page and every badge is yours. Revisit your favourite trail for a personal best.":atlas.completed===atlas.courses.length?"Six pages filled with your adventures. Revisit a trail for the badges you missed.":"Each trail adds a page to the atlas and teaches a new way to explore the sky."}</p><div className="journey-sky-pages" role="list" aria-label="Sky atlas pages">{atlas.courses.map((course,index)=><span role="listitem" key={course.id} data-complete={!!fair.courses[course.id]} aria-label={`Page ${index+1}: ${course.name}, ${fair.courses[course.id]?"complete":"waiting"}`}>{fair.courses[course.id]?"✦":String(index+1).padStart(2,"0")}</span>)}</div><p className="journey-sky-count">{atlas.completed} / {atlas.courses.length} pages · {atlas.medals} / {atlas.totalMedals} badges</p></div><div className="journey-sky-next"><span>{fair.courses[next.id]?"A REASON TO RETURN":"YOUR NEXT TRAIL"}</span><h3>{next.name}</h3><p>{fair.courses[next.id]?courseReplayGoal(fair.courses[next.id]):next.feature}</p><Link className="button primary" href={fairRunHref({gameId:"cloud-hop",courseId:next.id})}>{fair.courses[next.id]?"Revisit this trail":"Explore this trail"} →</Link></div></section>}
  </div>;
}
