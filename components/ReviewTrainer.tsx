"use client";

import Link from "next/link";
import { useState } from "react";
import type { ReviewItem } from "@/lib/api";
import useSignedInToken from "./learning/useSignedInToken";
import useReviewSession from "./learning/useReviewSession";
import styles from "./ReviewTrainer.module.css";

export default function ReviewTrainer() {
  const token = useSignedInToken();
  if (token === null) return <p role="status">Loading your review queue…</p>;
  if (!token) return <div className={styles.trainer}><p>Sign in to review your saved items. <Link href="/account">Sign in for reviews</Link></p></div>;
  return <AccountReviews key={token} token={token} />;
}

function AccountReviews({ token }: { token: string }) {
  const review = useReviewSession(token);
  const current = review.pending ? review.items.find(item => item.itemKey === review.pending!.itemKey) : review.items[0];
  return <section className={styles.trainer} aria-label="Personal review queue">
    {review.warning && <p role="status">{review.warning}</p>}
    {review.receipt && <div className={styles.saved} role="status"><strong>Review schedule saved.</strong><p>Next review: <time dateTime={review.receipt.dueAt}>{new Date(review.receipt.dueAt).toLocaleDateString()}</time>. Your rating updates the review schedule; it does not award XP or a mastery score.</p></div>}
    {review.needsSignIn ? <div role="alert"><p>{review.error}</p><Link href="/account">Sign in again</Link></div>
      : review.phase === "loading" ? <p role="status">Checking your saved review queue…</p>
      : review.phase === "corrupt" ? <div role="alert"><p>{review.error}</p><p>Leaving this unreadable local reference does not cancel a request already received by the server.</p><button className="button" disabled={review.busy} onClick={review.leaveReference}>Leave unreadable review reference</button></div>
      : <>
        {review.error && <p role="alert">{review.error}</p>}
        {review.pending && <div className={styles.pending}>
          <strong>Review response awaiting confirmation</strong>
          <p>Your selected rating is kept. Other ratings are locked until its saved schedule is confirmed.</p>
          <button className="button primary" disabled={review.busy || !review.canSchedule} onClick={review.retry}>{review.busy ? "Confirming…" : "Retry same review response"}</button>
          {review.missing && <><p>This item is no longer in your due queue. Leaving the reference does not cancel a request already received by the server.</p><button className="button" disabled={review.busy} onClick={review.leaveReference}>Leave missing review reference</button></>}
          {review.outdated && <><p>This review item has changed, and this response has no saved receipt. Keep the current queue by leaving the older local reference.</p><button className="button" disabled={review.busy} onClick={review.leaveReference}>Leave outdated review reference</button></>}
        </div>}
        {current && review.phase !== "error" && <ReviewCard key={current.itemKey} item={current} remaining={review.items.length} disabled={review.busy || !!review.pending || !review.canSchedule} grade={review.grade} />}
        {!current && review.phase === "ready" && <div className="empty-review"><h2>No reviews due</h2><p>Your saved queue has no due items. Incorrect practice answers will appear here when they are ready to review.</p></div>}
        <button className="button" disabled={review.busy} onClick={() => void review.refresh()}>Refresh saved review queue</button>
      </>}
  </section>;
}

function ReviewCard({ item, remaining, disabled, grade }: { item: ReviewItem; remaining: number; disabled: boolean; grade: (quality: number) => void }) {
  const [revealed, setRevealed] = useState(false);
  return <article className="review-card" aria-label="Current review item">
    <div className="review-meta"><span>{item.kind}</span><b>{remaining} remaining</b></div>
    <div className="review-prompt"><small>RECALL BEFORE REVEALING</small><h2>{item.prompt || item.itemKey}</h2>{revealed && <div className="review-answer"><small>EXPECTED CONNECTION</small><strong>{item.answer}</strong></div>}</div>
    {!revealed ? <button className="button primary wide" disabled={disabled} onClick={() => setRevealed(true)}>Reveal answer</button>
      : <div className="grade-row">{[[1, "Again"], [3, "Hard"], [4, "Good"], [5, "Easy"]].map(([quality, label]) => <button key={label} disabled={disabled} onClick={() => grade(Number(quality))}>{label}</button>)}</div>}
  </article>;
}
