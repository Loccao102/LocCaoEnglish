"use client";

import Link from "next/link";
import { APIError, getMe } from "@/lib/api";
import { getAnalytics } from "@/lib/platform";
import useAccountResource from "./learning/useAccountResource";
import useSignedInToken from "./learning/useSignedInToken";
import styles from "./TeacherAnalytics.module.css";

async function loadReport(token: string) {
  const account = await getMe(token);
  if (account.role !== "teacher" && account.role !== "admin") {
    throw new APIError("Teacher or admin access required", 403);
  }
  return getAnalytics(token);
}

export default function TeacherAnalytics() {
  const token = useSignedInToken();
  const report = useAccountResource(token, loadReport);
  const data = report.data;

  return <section className={styles.report} aria-label="Teacher practice report">
    {report.status === "guest" ? <p>Sign in with a teacher or admin account to view this report. <Link href="/account">Sign in for analytics</Link></p>
      : report.status === "loading" ? <p role="status">Loading checked practice report…</p>
      : report.needsSignIn ? <div role="alert"><p>Teacher or admin access is required. Sign in with an authorised account.</p><Link href="/account">Sign in again</Link></div>
      : report.status === "error" || data?.method !== "teacher-practice.v1" || data.practice?.windowDays !== 7 ? <div role="alert"><p>Checked practice reporting is unavailable. Please try again.</p><button className="button primary" onClick={report.refresh}>Retry analytics</button></div>
      : <>
        <div className={styles.heading}>
          <div><h2>Checked practice in the last 7 days</h2><p>Completed account rounds checked by the server. New replays count as practice; retrying the same saved result does not add a round.</p></div>
          <button className="button" onClick={report.refresh}>Refresh analytics</button>
        </div>
        <dl className={styles.totals}>
          <div><dt>Registered accounts</dt><dd>{data.learners}</dd></div>
          <div><dt>Active in checked practice</dt><dd>{data.practice.active7d}</dd></div>
          <div><dt>Checked rounds</dt><dd>{data.practice.attempts7d}</dd></div>
          <div><dt>Correct checked rounds</dt><dd>{data.practice.correct7d} <small>of {data.practice.attempts7d}</small></dd></div>
        </dl>
        <p className={styles.note}>Guided practice and transcript matching are shown separately below. These counts do not measure mastery, CEFR, independent recall or pronunciation. Legacy scores, story clears and IELTS estimates are excluded.</p>
        <section aria-label="Checked practice by skill" className={styles.skills}>
          <h2>Practice by skill</h2>
          {!data.practice.skills.length ? <p>No checked practice in this period.</p>
            : data.practice.skills.map(skill => <article key={skill.skill} aria-label={`${skill.skill} checked practice`}>
              <h3>{skill.skill}</h3>
              <p><strong>{skill.correct} correct · {skill.attempts} checked</strong></p>
              <p>{skill.learners} learners · {skill.evidenceKind === "transcript-match" ? "Transcript matching · does not assess pronunciation" : "Guided practice · help may be available"}</p>
            </article>)}
        </section>
        <section aria-label="Reported lesson activity" className={styles.lessons}>
          <h2>Reported lesson activity</h2>
          <p>Lesson starts and completions are learner reports, kept separately from checked practice. They do not establish a checked score.</p>
          {!data.lessons?.length ? <p>No published lesson activity.</p>
            : <ul>{data.lessons.map(lesson => <li key={lesson.slug}>
              <strong>{lesson.title}</strong><span>{lesson.started} started · {lesson.completed} completed</span>
            </li>)}</ul>}
        </section>
      </>}
  </section>;
}
