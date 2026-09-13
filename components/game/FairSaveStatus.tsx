"use client";
import Link from "next/link";
import { useFairProgress } from "./FairProgressProvider";

export default function FairSaveStatus({ compact = false }: { compact?: boolean }) {
  const progress = useFairProgress();
  const label = progress.status === "loading" ? "Opening your scrapbook…" : progress.owner === "guest" ? "Guest scrapbook · saved on this device" : progress.owner ? `${progress.name}’s scrapbook · ${progress.storageMode === "memory" ? "temporary server session" : "account save"}` : "Your account scrapbook is not connected";
  return <div className={`fair-save-status ${compact ? "compact" : ""}`}>
    <div role="status"><strong>{label}</strong>{progress.syncing ? <span>Syncing your memories…</span> : progress.pending > 0 ? <span>{progress.pending} {progress.pending === 1 ? "memory" : "memories"} waiting to sync</span> : null}{progress.warning && <span>{progress.warning}</span>}</div>
    <div>{progress.status !== "loading" && (progress.warning || progress.pending > 0) && <button type="button" disabled={progress.syncing} onClick={() => void progress.refresh()}>Retry sync</button>}{progress.owner === "guest" || progress.status === "error" ? <Link href="/account">Open account →</Link> : !compact && <Link href="/journey">My journey →</Link>}</div>
  </div>;
}
