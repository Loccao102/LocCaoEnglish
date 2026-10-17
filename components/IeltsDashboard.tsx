"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getIELTSHistory, type IELTSAttempt } from "@/lib/ielts";
import { getAuthToken } from "@/lib/session";
import useSignedInToken from "./learning/useSignedInToken";
import styles from "./IeltsDashboard.module.css";

const skills = [
  { key: "listening", label: "Listening", href: "/ielts/listening", copy: "40 questions · 4 audio parts", kind: "Saved choices checked by the server" },
  { key: "reading", label: "Academic Reading", href: "/ielts/reading", copy: "40 questions · 3 original passages", kind: "Saved choices checked by the server" },
  { key: "writing", label: "Writing", href: "/ielts/writing", copy: "Task 2 · feedback on your writing", kind: "Coaching only · no saved band" },
  { key: "speaking", label: "Speaking", href: "/ielts/speaking", copy: "Mic recording · language feedback", kind: "Coaching only · no saved band" },
];

function evidenceLabel(item: IELTSAttempt) {
  if (item.legacy) return "Legacy estimate · original answers unavailable";
  if (item.evidence === "server-objective-practice" && item.section === "reading") return "Server-checked Reading choices";
  if (item.evidence === "server-objective-practice" && item.section === "listening") return "Server-checked Listening choices · reported playback";
  return "Client-reported estimate · original answers unverified";
}

export default function IeltsDashboard() {
  const token = useSignedInToken();
  return <DashboardHistory key={token ?? "loading"} token={token} />;
}

function DashboardHistory({ token }: { token: string | null }) {
  const [history, setHistory] = useState<IELTSAttempt[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    let active = true;
    setStatus("loading"); setError("");
    getIELTSHistory(token, controller.signal).then(response => {
      if (!active || token !== getAuthToken()) return;
      setHistory(response.items); setStatus("ready");
    }).catch(reason => {
      if (!active || token !== getAuthToken()) return;
      setError(reason instanceof Error ? reason.message : "Practice history could not load."); setStatus("error");
    });
    return () => { active = false; controller.abort(); };
  }, [token, retry]);

  const latest = useMemo(() => {
    const entries: Record<string, IELTSAttempt> = {};
    history.forEach(item => {
      if ((item.section === "listening" || item.section === "reading") && !entries[item.section]) entries[item.section] = item;
    });
    return entries;
  }, [history]);

  return <div className={styles.dashboard}>
    <section className={styles.intro}>
      <span className="eyebrow">IELTS PRACTICE</span>
      <h1>Build skills. Understand your results.</h1>
      <p>Reading and Listening save your choices and check them against an answer key. Listening also keeps the playback reported by your browser. Writing and Speaking provide coaching without adding a band to this history.</p>
      <p>No overall band is calculated from these different kinds of practice.</p>
    </section>

    <section className={styles.skills} aria-label="IELTS skills">
      {skills.map(skill => {
        const recent = token && status === "ready" ? latest[skill.key] : undefined;
        return <Link href={skill.href} key={skill.key}>
          <h2>{skill.label}</h2>
          <p>{skill.copy}</p>
          <span>{skill.kind}</span>
          {recent && <p className={styles.estimate}><b>{recent.band.toFixed(1)}</b> latest estimate<br /><small>{evidenceLabel(recent)}</small></p>}
          <strong>Open practice →</strong>
        </Link>;
      })}
    </section>

    <section className={styles.history} aria-label="IELTS practice history">
      <span className="eyebrow">YOUR PRACTICE HISTORY</span>
      <h2>Recent results and their source</h2>
      {token === null || token && status === "loading" ? <p role="status">Loading practice history…</p>
        : !token ? <p>Sign in to see your saved practice. <Link href="/account">Sign in</Link></p>
        : status === "error" ? <div role="alert"><p>{error}</p><button className="button primary" onClick={() => setRetry(value => value + 1)}>Retry history</button></div>
        : !history.length ? <p>No saved IELTS practice yet. Complete a Reading practice to keep your answers and result here.</p>
        : <ol>{history.slice(0, 12).map(item => <li key={item.id}>
          <div className={styles.historyTop}>
            <h3>{item.section === "reading" ? "Academic Reading" : item.section.charAt(0).toUpperCase() + item.section.slice(1)}</h3>
            <strong>{item.band.toFixed(1)} <small>estimated band</small></strong>
          </div>
          <p>{item.rawScore != null ? `${item.rawScore}/${item.maxScore} correct · ` : ""}{evidenceLabel(item)}</p>
          <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString()}</time>
          {item.evidence === "server-objective-practice" && <details>
            <summary>Result details</summary>
            <p>Scoring provider: {item.provider}. Method: {item.methodVersion}.</p>
            <p>Content: {item.contentVersion}. Rules: {item.rulesVersion}.</p>
            <p>These choices were checked against the practice answer key. This is not an official IELTS score.</p>
          </details>}
        </li>)}</ol>}
    </section>
    <p className={styles.disclaimer}>All bands shown here are practice estimates. These original practice passages and question sets have not been calibrated as official IELTS tests.</p>
  </div>;
}
