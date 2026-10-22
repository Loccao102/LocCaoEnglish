"use client";

import {useEffect, useMemo, useState} from "react";
import {completeLesson, getLesson, type Lesson} from "@/lib/api";
import {getAuthToken} from "@/lib/session";
import useSignedInToken from "./learning/useSignedInToken";
const clean = (value: string) => value.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

export default function LessonPlayer({slug}: {slug: string}) {
  const token = useSignedInToken();
  return token === null ? <div className="panel">Loading lesson…</div> : <LessonRun key={`${slug}:${token}`} slug={slug} token={token} />;
}
function LessonRun({slug, token}: {slug: string; token: string}) {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [index, setIndex] = useState(0), [value, setValue] = useState("");
  const [checked, setChecked] = useState(false), [done, setDone] = useState(false);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [error, setError] = useState(""), [saving, setSaving] = useState(false);
  useEffect(() => {let alive = true; getLesson(slug).then(item => {if (alive) setLesson(item);}).catch(e => {if (alive) setError(e.message);}); return () => {alive = false;};}, [slug]);
  const ex = lesson?.exercises[index];
  const isCorrect = useMemo(() => !!ex?.answer && clean(value) === clean(ex.answer), [value, ex]);
  const checks = lesson?.exercises.filter(item => !!item.answer).length || 0;
  const correct = Object.values(answers).filter(Boolean).length;
  function check() {
    if (!ex || !value.trim()) return;
    setChecked(true);
    if (ex.answer) setAnswers(old => ({...old, [ex.id]: isCorrect}));
  }
  async function next() {
    if (!lesson || saving || token !== getAuthToken()) return;
    if (index < lesson.exercises.length - 1) {setIndex(i => i + 1); setValue(""); setChecked(false); return;}
    setSaving(true); setError("");
    try {if (token) await completeLesson(lesson.slug, lesson.exercises.length, checks ? correct / checks : 0); if (getAuthToken() === token) setDone(true);}
    catch {if (getAuthToken() === token) setError("Your local checks are kept. The completion bookmark was not confirmed; retry Finish lesson when connected.");}
    finally {if (getAuthToken() === token) setSaving(false);}
  }
  if (!lesson || !ex) return <div className="panel">{error || "Loading lesson…"}</div>;
  if (done) return <section className="lesson-player"><span className="eyebrow">LOCAL PRACTICE COMPLETE</span><h1>{lesson.title}</h1>
    <div className="completion-score"><strong>{correct}/{checks}</strong><span>local reference matches; open responses are ungraded</span></div>
    <p>Your completion bookmark is self-reported. These checks award no XP, mastery or checked-practice rank.</p>
    <button className="button primary" onClick={() => {setIndex(0); setValue(""); setChecked(false); setAnswers({}); setDone(false);}}>Practice again</button></section>;
  return <section className="lesson-player"><div className="lesson-run-head"><div><span className="eyebrow">{lesson.level} · {lesson.skill} · {lesson.topic}</span><h1>{lesson.title}</h1></div><b>{index+1}/{lesson.exercises.length}</b></div>
    <p>Local reference practice. Open responses need a coach; no automatic language score or XP is awarded here.</p>
    <div className="progress large"><i style={{width: `${index/lesson.exercises.length*100}%`}} /></div>
    <article className="lesson-exercise"><span className="exercise-kind">{ex.kind}</span><h2>{ex.prompt}</h2>
      {ex.options?.length ? <div className="lesson-options">{ex.options.map(option => <button disabled={checked} key={option} className={value===option ? "selected" : ""} onClick={() => setValue(option)}>{option}</button>)}</div> :
        <textarea aria-label="Lesson response" className="practice-textarea short" readOnly={checked} value={value} onChange={e => setValue(e.target.value)} placeholder={ex.kind === "speaking" ? "Say it aloud, then type what you said…" : "Type your response…"} />}
      {!checked ? <button className="button primary" disabled={!value.trim()} onClick={check}>{ex.answer ? "Compare with reference" : "Review my response"}</button> :
        <div className={`feedback-box ${!ex.answer || isCorrect ? "success" : "error"}`}><div><strong>{!ex.answer ? "Response noted locally · ungraded" : isCorrect ? "Reference matches" : `Reference: ${ex.answer}`}</strong><p>{ex.explanation}</p></div>
          <button className="button primary" disabled={saving} onClick={() => void next()}>{saving ? "Saving bookmark…" : index===lesson.exercises.length-1 ? "Finish lesson" : "Next →"}</button></div>}
      {error && <p role="alert">{error}</p>}
    </article></section>;
}
