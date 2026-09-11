"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DailyPlan, getPlan } from "@/lib/api";

const fallback: DailyPlan = {
  focus: "Speaking recovery",
  totalMins: 28,
  potentialXp: 115,
  items: [
    { id: "offline-1", title: "Shadow & respond", skill: "Speaking", activity: "Shadowing", reason: "Speaking is currently one of your weakest areas.", minutes: 7, xp: 30, route: "/speaking", priority: 1 },
    { id: "offline-2", title: "IELTS micro-writing", skill: "Writing", activity: "Writing", reason: "Build controlled arguments before a full essay.", minutes: 10, xp: 35, route: "/ielts", priority: 2 },
    { id: "offline-3", title: "Dictation Rush", skill: "Dictation", activity: "Dictation", reason: "Train listening accuracy and spelling together.", minutes: 6, xp: 40, route: "/dictation", priority: 3 },
  ],
};

export default function AdaptivePlan() {
  const [plan, setPlan] = useState<DailyPlan>(fallback);
  const [live, setLive] = useState(false);

  useEffect(() => {
    getPlan().then((value) => { setPlan(value); setLive(true); }).catch(() => setLive(false));
  }, []);

  return (
    <section className="panel adaptive-plan">
      <div className="section-heading">
        <div><span className="eyebrow">ADAPTIVE ROUTE</span><h2>{plan.focus}</h2></div>
        <span className={`mode-badge ${live ? "" : "warning"}`}>{live ? "● LIVE ENGINE" : "OFFLINE FALLBACK"}</span>
      </div>
      <div className="plan-summary"><span>◷ {plan.totalMins} min</span><span>✦ up to {plan.potentialXp} XP</span><span>{plan.items.length} activities</span></div>
      <div className="plan-grid">
        {plan.items.slice(0, 4).map((item, index) => (
          <Link href={item.route} className="plan-step" key={item.id}>
            <span className="plan-number">{index + 1}</span>
            <div><small>{item.skill} · {item.minutes} min</small><strong>{item.title}</strong><p>{item.reason}</p></div>
            <b>+{item.xp} XP →</b>
          </Link>
        ))}
      </div>
    </section>
  );
}
