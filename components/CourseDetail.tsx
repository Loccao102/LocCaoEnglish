"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { getAuthToken } from "@/lib/session";
import { APIError } from "@/lib/api";
import { enrollCourse, getCourse, getCourseProgress, type Course } from "@/lib/platform";
import useAccountResource from "./learning/useAccountResource";
import useSignedInToken from "./learning/useSignedInToken";
import styles from "./CourseDetail.module.css";

export default function CourseDetail({ slug }: { slug: string }) {
  return <CourseView key={slug} slug={slug} />;
}

function CourseView({ slug }: { slug: string }) {
  const token = useSignedInToken();
  const [course, setCourse] = useState<Course | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError(false);
    void getCourse(slug).then(data => { if (active) setCourse(data); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [slug, retry]);

  if (error) return <div role="alert"><p>This course could not load.</p><button className="button" onClick={() => setRetry(value => value + 1)}>Retry course</button></div>;
  if (!course) return <p role="status">Loading course…</p>;
  return <div className={`course-detail ${styles.shell}`}>
    <header>
      <span className="eyebrow">COURSE · {course.level}</span>
      <h1>{course.title}</h1><p>{course.description}</p>
      <PersonalCourse key={token ?? "loading"} token={token} slug={slug} />
    </header>
    <section className="course-lessons" aria-label="Course lessons">
      {course.lessons.map((lesson, index) => <Link href={`/learn/${lesson.slug}`} key={lesson.slug}>
        <span>{index + 1}</span><div><small>{lesson.skill} · {lesson.level} · {lesson.estimatedMins} min</small><strong>{lesson.title}</strong></div><b>Start →</b>
      </Link>)}
    </section>
  </div>;
}

function PersonalCourse({ token, slug }: { token: string | null; slug: string }) {
  const load = useCallback((owner: string) => getCourseProgress(slug, owner), [slug]);
  const progress = useAccountResource(token, load);
  const active = useRef(true), pending = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  async function enroll() {
    if (!token || token !== getAuthToken() || pending.current || progress.status !== "ready" || progress.data?.enrolled) return;
    const owner = token;
    pending.current = true; setSaving(true); setError(false);
    // A response from an older progress read cannot replace the enrolled state.
    progress.invalidate();
    try {
      const saved = await enrollCourse(slug, owner);
      if (active.current && owner === getAuthToken()) progress.replace(owner, saved);
    } catch (reason) {
      if (active.current && owner === getAuthToken()) {
        if (reason instanceof APIError && (reason.status === 401 || reason.status === 403)) setNeedsSignIn(true);
        else setError(true);
      }
    } finally {
      pending.current = false;
      if (active.current && owner === getAuthToken()) setSaving(false);
    }
  }

  return <section className={styles.personal} aria-label="Personal course progress">
    {progress.status === "guest" ? <p><Link href="/account">Sign in for course progress</Link>. You can browse the lessons without enrolling.</p>
      : progress.status === "loading" ? <p role="status">Loading your course progress…</p>
      : progress.needsSignIn || needsSignIn ? <p role="alert">Your course progress needs a signed-in account. <Link href="/account">Sign in again</Link></p>
      : progress.status === "error" || !progress.data ? <div role="alert"><p>Your saved course progress is unavailable. The lesson list is still available.</p><button className="button" onClick={progress.refresh}>Retry course progress</button></div>
      : <>
        <p><strong>{progress.data.completedLessons}/{progress.data.totalLessons}</strong> lessons reported complete</p>
        {!error && <p>{progress.data.enrolled ? "You are enrolled in this course." : "You have not enrolled in this course."}</p>}
        <p>Lesson completion is a personal record, not a checked mastery score.</p>
        {error && <p role="alert">Enrollment could not be confirmed. Refresh your saved progress or retry; the same enrollment will not be added twice.</p>}
        {!progress.data.enrolled && <button className="button primary" disabled={saving} onClick={() => void enroll()}>{saving ? "Enrolling…" : error ? "Retry enrollment" : "Enroll in course"}</button>}
        <button className="button" disabled={saving} onClick={() => { setError(false); progress.refresh(); }}>Refresh course progress</button>
      </>}
  </section>;
}
