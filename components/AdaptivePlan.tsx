"use client";

import Link from "next/link";
import { usePracticePlan } from "./learning/usePracticeDashboard";

export default function AdaptivePlan() {
  const { data: plan, status, needsSignIn, refresh } = usePracticePlan();
  return <section className="panel adaptive-plan practice-plan" aria-label="Practice suggestions">
    <div className="section-heading">
      <div><span className="eyebrow">WHAT TO PRACTICE NEXT</span><h2>{plan?.focus ?? (status === "guest" ? "Choose your next practice" : status === "loading" ? "Loading practice suggestions…" : "Practice suggestions unavailable")}</h2></div>
      {plan && <button className="button ghost" onClick={refresh}>Refresh suggestions</button>}
    </div>
    {!plan ? <div className="practice-empty" role={status === "error" ? "alert" : "status"}>
      <p>{status === "guest" ? "Sign in for suggestions based on your saved practice and learning goal." : status === "loading" ? "Reading your recent checked work…" : needsSignIn ? "Sign in again to see suggestions for your account." : "We could not load your suggestions. Your saved practice is unchanged."}</p>
      {(status === "guest" || needsSignIn) && <Link className="button primary" href="/account">{needsSignIn ? "Sign in again" : "Sign in for practice suggestions"}</Link>}
      {status === "error" && <button className="button ghost" onClick={refresh}>Retry loading suggestions</button>}
    </div> : <>
      <div className="plan-summary"><span>◷ About {plan.totalMins} minutes</span><span>{plan.items.length} suggested activities</span></div>
      <p className="practice-note">Suggestions can change as you practice. Your saved daily checklist stays fixed; each activity explains its own rewards.</p>
      <div className="plan-grid">{plan.items.slice(0, 4).map((item, index) => <Link href={item.route} className="plan-step" key={item.id}>
        <span className="plan-number">{index + 1}</span>
        <div><small>{item.skill} · {item.minutes} min</small><strong>{item.title}</strong><p>{item.reason}</p></div>
        <b>Open activity →</b>
      </Link>)}</div>
    </>}
  </section>;
}
