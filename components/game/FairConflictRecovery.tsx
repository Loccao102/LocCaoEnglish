"use client";

import { useState } from "react";
import { difficultyName } from "@/lib/game/challenge";
import { festivalById } from "@/lib/game/festival";
import type { FairCompletion } from "@/lib/game/fair-progress";
import { useFairProgress } from "./FairProgressProvider";
import styles from "./FairConflictRecovery.module.css";

function resultLabel(result: FairCompletion) {
  const details = [`${result.stars} ${result.stars === 1 ? "star" : "stars"}`, difficultyName[result.difficulty || "practice"]];
  if (result.courseId) details.push(`${result.feathers || 0} feathers`, `${((result.elapsedMs || 0) / 1000).toFixed(1)} seconds`);
  return details.join(" · ");
}

export default function FairConflictRecovery() {
  const progress = useFairProgress();
  const [exportError, setExportError] = useState("");
  if (progress.status !== "ready" || !progress.owner || progress.owner === "guest" || (!progress.conflicts.length && !progress.archived.length)) return null;

  function download() {
    try {
      const blob = new Blob([JSON.stringify({ version: 1, method: "fair-conflict-export.v1", playerId: progress.owner, copies: progress.archived }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob), anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "fair-kept-copies.json";
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportError("");
    } catch { setExportError("The download could not start. Your local copies are still kept on this device."); }
  }

  return <section className={styles.recovery} aria-label="Saved memory conflicts">
    {!!progress.conflicts.length && <>
      <h3>A memory is already saved</h3>
      <p>Two tabs finished the same run differently. The first saved result stays in your scrapbook. Your queued copy is still on this device.</p>
      {progress.conflicts.map(conflict => {
        const name = festivalById(conflict.queued.gameId)?.name || "Fair";
        return <article key={conflict.queued.runId} aria-label={`${name} memory conflict`}>
          <h4>{name}</h4>
          {conflict.saved.gameId !== conflict.queued.gameId && <p>Saved game: {festivalById(conflict.saved.gameId)?.name || conflict.saved.gameId}</p>}
          <p>Saved result: {resultLabel(conflict.saved)}</p>
          <p>Queued copy: {resultLabel(conflict.queued)}</p>
          <p>Keep the queued copy for reference and stop retrying it. It will not add another clear or change the saved result.</p>
          <button type="button" disabled={progress.syncing || progress.resolving} onClick={() => void progress.resolveConflict(conflict.queued.runId)}>
            {progress.resolving ? "Checking saved result…" : "Keep local copy and use saved result"}
          </button>
        </article>;
      })}
    </>}
    {!!progress.archived.length && <details>
      <summary>Kept local copies ({progress.archived.length})</summary>
      <p>These copies stay in this browser for this account. They are not uploaded again and do not count as extra clears.</p>
      <ul>{progress.archived.map(copy => <li key={copy.queued.runId}>{festivalById(copy.queued.gameId)?.name || "Fair"}: queued {resultLabel(copy.queued)}; saved {resultLabel(copy.saved)}</li>)}</ul>
      <button type="button" onClick={download}>Download kept copies</button>
    </details>}
    {exportError && <p role="alert">{exportError}</p>}
  </section>;
}
