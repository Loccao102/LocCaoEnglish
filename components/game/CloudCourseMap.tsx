"use client";

import { coursesFor, courseTime, courseUnlocked } from "@/lib/game/fair-courses";
import { useFairProgress } from "./FairProgressProvider";
import { useFairCheckpoints } from "./useFairCheckpoints";

export default function CloudCourseMap({selected,onSelect}:{selected:string;onSelect:(id:string)=>void}){
  const progress=useFairProgress(),courses=coursesFor("cloud-hop"),saved=useFairCheckpoints();
  const medals=courses.reduce((sum,course)=>sum+(progress.courses[course.id]?.medals||0),0);
  return <section className="cloud-atlas" aria-label="Mây’s sky atlas">
    <div className="cloud-atlas-heading"><strong>Mây’s sky atlas</strong><span>{medals} / 18 badges</span></div>
    <div className="cloud-course-grid" role="group" aria-label="Choose a Cloud Hop course">{courses.map((course,index)=>{
      const record=progress.courses[course.id],unlocked=courseUnlocked(course.id,progress.courses,!!progress.save.games["cloud-hop"]?.visits),checkpoint=saved.find(run=>run.run.courseId===course.id);
      return <button key={course.id} type="button" disabled={!unlocked} aria-pressed={selected===course.id} aria-label={`Course ${index+1}: ${course.name}${unlocked?"":", locked"}`} onClick={()=>onSelect(course.id)}>
        <span className="cloud-course-number">{unlocked?String(index+1).padStart(2,"0"):"⌑"}</span><strong>{course.name}</strong><small>{course.feature}</small>
        <span className="cloud-course-medals">{record?`${"✦".repeat(record.medals)}${"◇".repeat(3-record.medals)}`:unlocked?"◇ ◇ ◇":"Finish the previous course"}</span>
        {record&&<small>Best {courseTime(record.bestMs)}</small>}
        {checkpoint&&<small className="cloud-saved-marker">{checkpoint.session.state.phase==="win"?"Result waiting to save":`Saved at ring ${checkpoint.session.state.round+1}`}</small>}
      </button>;
    })}</div>
    <p>Earn a badge for finishing, a clean flight, and all 3 feathers. Replay to collect the ones you missed.</p>
  </section>;
}
