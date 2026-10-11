// Guided phrases are intentionally visible. Keep one catalog for server and UI.
import catalog from "@/backend/internal/learning/shadowing_catalog.json";
export type LearningPack = { label: string; speakingPrompts: string[] };
export function speakingPack(key?: string) {
  return catalog.packs.find(pack => pack.id === key) || catalog.packs[0];
}
export function getLearningPack(key?: string): LearningPack {
  const pack = speakingPack(key);
  return { label: pack.label, speakingPrompts: pack.items.map(item => item.text) };
}
