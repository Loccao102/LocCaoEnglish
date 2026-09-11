"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { calculateOverall, getIELTSHistory, IELTSAttempt } from "@/lib/ielts";

const floors = [
  { key: "listening", floor: "FLOOR 1", label: "Listening", href: "/ielts/listening", copy: "40 questions · 4 audio parts · one-play mock", icon: "◉" },
  { key: "reading", floor: "FLOOR 2", label: "Academic Reading", href: "/ielts/reading", copy: "40 questions · 3 original academic-style passages", icon: "▤" },
  { key: "writing", floor: "FLOOR 3", label: "Writing", href: "/ielts/writing", copy: "Task 2 · four-criterion AI/local coach", icon: "✎" },
  { key: "speaking", floor: "FLOOR 4", label: "Speaking", href: "/ielts/speaking", copy: "Mic recording · language coach · optional acoustic assessment", icon: "◉" },
];

export default function IeltsDashboard() {
  const [history, setHistory] = useState<IELTSAttempt[]>([]);
  const [overall, setOverall] = useState<number | null>(null);

  useEffect(() => {
    getIELTSHistory().then((result) => setHistory(result.items)).catch(() => {});
  }, []);

  const latest = useMemo(() => {
    const result: Record<string, IELTSAttempt> = {};
    history.forEach((attempt) => { if (!result[attempt.section]) result[attempt.section] = attempt; });
    return result;
  }, [history]);

  const cleared = floors.filter((floor) => latest[floor.key]).length;

  async function calculate() {
    if (floors.every((floor) => latest[floor.key])) {
      const result = await calculateOverall(
        latest.listening.band,
        latest.reading.band,
        latest.writing.band,
        latest.speaking.band,
      );
      setOverall(result.overall);
    }
  }

  return (
    <div className="ielts-dashboard">
      <section className="ielts-overview">
        <div>
          <span className="eyebrow">IELTS TOWER · CHALLENGE MODE</span>
          <h1>Clear four floors. Build one overall band.</h1>
          <p>Listening and Reading keep the real raw score. Writing and Speaking use criterion-based practice estimates. Clear every floor to calculate your latest overall run.</p>
          <div className="plan-summary"><span>{cleared}/4 floors cleared</span><span>practice history saved</span><span>target: consistency, not one lucky run</span></div>
        </div>
        <div className="overall-orb">
          <strong>{overall?.toFixed(1) ?? "—"}</strong>
          <span>tower rating</span>
          <button disabled={!floors.every((floor) => latest[floor.key])} onClick={() => void calculate()}>
            {cleared === 4 ? "Calculate run" : `Clear ${4 - cleared} more`}
          </button>
        </div>
      </section>

      <section className="ielts-skill-grid">
        {floors.map((floor) => (
          <Link href={floor.href} key={floor.key}>
            <span>{floor.floor} · {floor.icon} {floor.label}</span>
            <strong>{latest[floor.key]?.band?.toFixed(1) ?? "—"}</strong>
            <p>{floor.copy}</p>
            <b>{latest[floor.key] ? "Run again →" : "Enter floor →"}</b>
          </Link>
        ))}
      </section>

      <section className="panel ielts-history">
        <div className="section-heading">
          <div><span className="eyebrow">RUN HISTORY</span><h2>Your recent tower attempts</h2></div>
        </div>
        {history.length === 0 ? (
          <p className="muted">No floors cleared yet. Start with Listening or Reading to record your first run.</p>
        ) : history.slice(0, 12).map((item) => (
          <div key={item.id}>
            <span>{item.section}</span>
            <small>{item.rawScore != null ? `${item.rawScore}/${item.maxScore}` : item.source}</small>
            <b>{item.band.toFixed(1)}</b>
            <time>{new Date(item.createdAt).toLocaleDateString()}</time>
          </div>
        ))}
      </section>

      <p className="ielts-disclaimer">Practice estimates only. IELTS states that exact raw-score thresholds for Listening and Reading can vary slightly between test versions.</p>
    </div>
  );
}
