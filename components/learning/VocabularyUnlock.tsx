import type { VocabularyUnlock, WorldState } from "@/lib/api";

export function currentVocabularyUnlock(value?: VocabularyUnlock): VocabularyUnlock | null {
  if (!value || value.method !== "vocabulary-unlocks.v1") return null;
  if (![value.correctItems, value.targetItems, value.activityCount, value.targetActivities].every(Number.isInteger)
    || value.correctItems < 0 || value.correctItems > 7 || value.targetItems <= 0
    || value.activityCount < 0 || value.activityCount > 3 || value.targetActivities <= 0) return null;
  return value;
}

export function vocabularySource(value?: VocabularyUnlock): string | null {
  const receipt = currentVocabularyUnlock(value)?.receipt;
  if (!receipt || receipt.method !== "vocabulary-unlocks.v1") return null;
  switch (receipt.source) {
    case "legacy-personal": return "Previously unlocked · kept";
    case "checked-practice": return "Checked vocabulary practice";
    case "personal-xp": return "Personal XP milestone";
    default: return null;
  }
}

export function worldStatus(world: WorldState): string {
  if (world.id !== "words") return world.unlocked ? `${world.progress}% explored` : "LOCKED";
  if (world.unlocked) return vocabularySource(world.unlock) ?? "Open · unlock details unavailable";
  return currentVocabularyUnlock(world.unlock) ? "Vocabulary practice milestone" : "Unlock details unavailable";
}

export default function VocabularyUnlockNote({ unlock, unlocked, world = false }: { unlock?: VocabularyUnlock; unlocked: boolean; world?: boolean }) {
  const current = currentVocabularyUnlock(unlock);
  const source = vocabularySource(current ?? undefined);
  if (!current) return <p className="vocabulary-unlock-note">Unlock details unavailable. Your saved access is shown above.</p>;
  return <div className="vocabulary-unlock-note">
    {unlocked && <strong>{source ?? "Unlock details unavailable"}</strong>}
    {unlocked && source === "Previously unlocked · kept" ? <p>Your earlier access is preserved. No checked practice is claimed for this earlier unlock.</p> : <>
      <p>{Math.min(current.correctItems, current.targetItems)}/{current.targetItems} different vocabulary items answered correctly · {Math.min(current.activityCount, current.targetActivities)}/{current.targetActivities} {current.targetActivities === 1 ? "activity" : "activities"}</p>
      <p>A cumulative guided practice milestone. Repeats do not add items; later mistakes keep earlier unlocks.</p>
    </>}
    {world && !unlocked && <p>You can also open this milestone with 300 personal XP. Direct word practice is always available.</p>}
  </div>;
}
