"use client";

import { useEffect, useState } from "react";
import { getReviews, gradeReview, ReviewItem } from "@/lib/api";

export default function ReviewTrainer() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [status, setStatus] = useState("Loading your adaptive review queue…");

  useEffect(() => { getReviews().then((r) => { setItems(r.items); setStatus(r.items.length ? "" : "Nothing is due yet. Miss a few game questions and they will appear here automatically."); }).catch(() => setStatus("Start the Go API to sync your live review queue. The rest of the app still works in offline mode.")); }, []);
  const current = items[index];

  async function grade(quality: number) {
    if (!current) return;
    try { await gradeReview(current.itemKey, quality); } catch {}
    const next = items.filter((_, i) => i !== index);
    setItems(next); setIndex(0); setRevealed(false);
    if (!next.length) setStatus("Review complete. Your next due items will be scheduled automatically.");
  }

  if (!current) return <div className="empty-review"><span>✓</span><h2>Review queue clear</h2><p>{status}</p></div>;

  return (
    <section className="review-card">
      <div className="review-meta"><span>{current.kind}</span><b>{items.length} remaining</b></div>
      <div className="review-prompt"><small>RECALL BEFORE REVEALING</small><h2>{current.prompt || current.itemKey}</h2>{revealed && <div className="review-answer"><small>EXPECTED CONNECTION</small><strong>{current.answer}</strong></div>}</div>
      {!revealed ? <button className="button primary wide" onClick={() => setRevealed(true)}>Reveal answer</button> : <div className="grade-row"><button onClick={() => grade(1)}>Again</button><button onClick={() => grade(3)}>Hard</button><button onClick={() => grade(4)}>Good</button><button onClick={() => grade(5)}>Easy</button></div>}
    </section>
  );
}
