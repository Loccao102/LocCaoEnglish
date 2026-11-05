"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { APIError, type Lesson, type LessonExercise } from "@/lib/api";
import { deleteAdminLesson, getAdminLessons, getContentMe, saveAdminLesson } from "@/lib/content-admin";
import { getAuthToken } from "@/lib/session";
import useSignedInToken from "./learning/useSignedInToken";
import styles from "./ContentStudio.module.css";

const emptyExercise = (): LessonExercise => ({ id: "", kind: "choice", prompt: "", answer: "", options: [], explanation: "", position: 0, xp: 10 });
const emptyLesson = (): Lesson => ({ id: "", slug: "", title: "", description: "", level: "B1", skill: "Vocabulary", topic: "General", status: "draft", estimatedMins: 10, exercises: [emptyExercise()] });
const permissionMessage = "Teacher/admin role required. Sign in with an authorised account.";
function editableLesson(value: Lesson): Lesson {
  if (!value || typeof value.id !== "string" || !value.id || typeof value.slug !== "string" || !value.slug || value.exercises !== null && !Array.isArray(value.exercises)) throw new Error("Invalid lesson response");
  return { ...value, exercises: (value.exercises || []).map(exercise => {
    if (exercise.options !== null && !Array.isArray(exercise.options)) throw new Error("Invalid exercise options");
    return { ...exercise, options: exercise.options || [] };
  }) };
}

export default function ContentStudio() {
  const token = useSignedInToken();
  if (token === null) return <div className="panel" role="status">Checking permissions…</div>;
  if (!token) return <div className={`notice error ${styles.studio}`} role="alert" aria-label="Content Studio access"><p>Teacher/admin role required. Sign in with a teacher or admin account to open Content Studio.</p><Link href="/account">Sign in</Link></div>;
  return <ContentStudioAccount key={token} token={token} />;
}

function ContentStudioAccount({ token }: { token: string }) {
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Lesson[]>([]);
  const [lesson, setLesson] = useState<Lesson>(emptyLesson());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const active = useRef(true), sequence = useRef(0), pending = useRef(false);
  const current = (owner: string, request: number) => active.current && owner === token && owner === getAuthToken() && request === sequence.current;
  const currentOwner = () => active.current && token === getAuthToken();

  async function refresh() {
    if (!currentOwner()) return;
    const request = ++sequence.current;
    setLoading(true); setLoadError("");
    try {
      const me = await getContentMe(token);
      if (!current(token, request)) return;
      setRole(me.role);
      if (me.role !== "teacher" && me.role !== "admin") { setItems([]); setLesson(emptyLesson()); return; }
      const result = await getAdminLessons(token);
      if (!current(token, request)) return;
      if (result.items !== null && !Array.isArray(result.items)) throw new Error("Invalid lesson list");
      setItems((result.items || []).map(editableLesson)); setLoadError("");
    } catch (error) {
      if (!current(token, request)) return;
      setRole(""); setItems([]);
      setLoadError(error instanceof APIError && (error.status === 401 || error.status === 403) ? permissionMessage : "Content Studio is unavailable. Your edits are kept for this account; please retry.");
    } finally { if (current(token, request)) setLoading(false); }
  }

  useEffect(() => { active.current = true; void refresh(); return () => { active.current = false; sequence.current++; }; }, [token]);

  function patchExercise(index: number, patch: Partial<LessonExercise>) {
    if (pending.current) return;
    setLesson(value => ({ ...value, exercises: value.exercises.map((item, i) => i === index ? { ...item, ...patch } : item) }));
  }

  async function save() {
    if (pending.current || !currentOwner() || (role !== "teacher" && role !== "admin")) return;
    const owner = token; pending.current = true; setBusy(true); setMessage("");
    try {
      const saved = await saveAdminLesson({ ...lesson, estimatedMins: Number(lesson.estimatedMins), exercises: lesson.exercises.map((item, i) => ({ ...item, position: i, xp: Number(item.xp) || 10 })) }, owner);
      if (!currentOwner()) return;
      setLesson(editableLesson(saved)); setMessage("Lesson saved."); await refresh();
    } catch (error) {
      if (currentOwner()) {
        if (error instanceof APIError && (error.status === 401 || error.status === 403)) { setRole(""); setItems([]); setLoadError(permissionMessage); }
        else setMessage("Saving could not be confirmed. Your edits are still here; refresh the lesson list to check before retrying.");
      }
    } finally { if (currentOwner()) { pending.current = false; setBusy(false); } }
  }

  async function remove(slug: string) {
    if (pending.current || !currentOwner() || (role !== "teacher" && role !== "admin") || !window.confirm(`Delete ${slug}?`)) return;
    const owner = token; pending.current = true; setBusy(true); setMessage("");
    try {
      await deleteAdminLesson(slug, owner);
      if (!currentOwner()) return;
      setLesson(emptyLesson()); setMessage("Lesson deleted."); await refresh();
    } catch (error) {
      if (currentOwner()) {
        if (error instanceof APIError && (error.status === 401 || error.status === 403)) { setRole(""); setItems([]); setLoadError(permissionMessage); }
        else setMessage("Deletion could not be confirmed. Your edits are still here; refresh the lesson list to check before retrying.");
      }
    } finally { if (currentOwner()) { pending.current = false; setBusy(false); } }
  }

  if (loading) return <div className="panel" role="status">Checking permissions…</div>;
  if (loadError) return <div className={`notice error ${styles.studio}`} role="alert" aria-label="Content Studio access"><p>{loadError}</p><button className="button" disabled={busy} onClick={() => void refresh()}>Retry Content Studio</button><Link href="/account">Sign in again</Link></div>;
  if (role !== "teacher" && role !== "admin") return <div className={`notice error ${styles.studio}`} role="alert" aria-label="Content Studio access"><p>{permissionMessage}</p><Link href="/account">Sign in again</Link></div>;
  return <div className={`studio-layout ${styles.studio}`}>
    <aside className="studio-list"><div className="section-heading"><div><span className="eyebrow">CONTENT CMS</span><h2>Lessons</h2></div><button className="button ghost" disabled={busy} onClick={() => setLesson(emptyLesson())}>New</button></div><button className="button" disabled={busy} onClick={() => void refresh()}>Refresh lesson list</button>{items.map(item => <button key={item.slug} disabled={busy} onClick={() => setLesson(item)} className={lesson.slug === item.slug ? "active" : ""}><strong>{item.title}</strong><small>{item.status} · {item.level} · {item.skill}</small></button>)}</aside>
    <section className="studio-editor"><div className="form-grid">
      <label>Title<input disabled={busy} value={lesson.title} onChange={e => setLesson(v => ({ ...v, title: e.target.value }))} /></label><label>Slug<input disabled={busy} value={lesson.slug} onChange={e => setLesson(v => ({ ...v, slug: e.target.value }))} /></label><label>Level<select disabled={busy} value={lesson.level} onChange={e => setLesson(v => ({ ...v, level: e.target.value }))}>{["A1", "A2", "B1", "B2", "C1", "C2"].map(x => <option key={x}>{x}</option>)}</select></label><label>Skill<input disabled={busy} value={lesson.skill} onChange={e => setLesson(v => ({ ...v, skill: e.target.value }))} /></label><label>Topic<input disabled={busy} value={lesson.topic} onChange={e => setLesson(v => ({ ...v, topic: e.target.value }))} /></label><label>Status<select disabled={busy} value={lesson.status} onChange={e => setLesson(v => ({ ...v, status: e.target.value as Lesson["status"] }))}><option value="draft">draft</option><option value="published">published</option></select></label><label className="span-2">Description<textarea disabled={busy} value={lesson.description} onChange={e => setLesson(v => ({ ...v, description: e.target.value }))} /></label>
    </div><div className="exercise-builder"><div className="section-heading"><div><span className="eyebrow">EXERCISES</span><h2>{lesson.exercises.length} blocks</h2></div><button className="button ghost" disabled={busy} onClick={() => setLesson(v => ({ ...v, exercises: [...v.exercises, emptyExercise()] }))}>+ Exercise</button></div>{lesson.exercises.map((ex, i) => <article className="exercise-editor" key={i}><div className="exercise-editor-head"><strong>#{i + 1}</strong><select disabled={busy} value={ex.kind} onChange={e => patchExercise(i, { kind: e.target.value })}><option>choice</option><option>input</option><option>dictation</option><option>speaking</option><option>writing</option></select><button disabled={busy} onClick={() => setLesson(v => ({ ...v, exercises: v.exercises.filter((_, x) => x !== i) }))}>Remove</button></div><label>Prompt<textarea disabled={busy} value={ex.prompt} onChange={e => patchExercise(i, { prompt: e.target.value })} /></label><label>Answer<input disabled={busy} value={ex.answer} onChange={e => patchExercise(i, { answer: e.target.value })} /></label><label>Options (one per line)<textarea disabled={busy} value={ex.options.join("\n")} onChange={e => patchExercise(i, { options: e.target.value.split("\n").map(x => x.trim()).filter(Boolean) })} /></label><label>Explanation<textarea disabled={busy} value={ex.explanation} onChange={e => patchExercise(i, { explanation: e.target.value })} /></label></article>)}</div><div className="studio-actions"><span role="status">{message}</span>{lesson.slug && <button className="button ghost" disabled={busy} onClick={() => void remove(lesson.slug)}>Delete</button>}<button className="button primary" disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save lesson"}</button></div></section>
  </div>;
}
