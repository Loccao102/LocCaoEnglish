import { companions, quests, type Quest } from "./catalog";

export type AdventureSave = { version: 1; completed: Record<string, number>; xp: number; coins: number; owned: string[]; character: string };
export type Verdict = { correct: number; stars: number; passed: boolean; xp: number; coins: number; firstClear: boolean };
export const newAdventure = (): AdventureSave => ({ version: 1, completed: {}, xp: 0, coins: 0, owned: ["mam"], character: "mam" });
export const normalizeAnswer = (text: string) => text.toLowerCase().replace(/[.,!?;:’']/g, "").trim().replace(/\s+/g, " ");
export function gradeQuest(quest: Quest, answers: string[]): Verdict {
  const correct = quest.questions.filter((q, i) => normalizeAnswer(answers[i] ?? "") === normalizeAnswer(q.answer)).length;
  const passed = answers.length === quest.questions.length && correct >= 2;
  return { correct, passed, stars: passed ? correct : 0, xp: 0, coins: 0, firstClear: false };
}
export const questOpen = (save: AdventureSave, quest: Quest) => !quest.requires || (save.completed[quest.requires] ?? 0) >= 2;
export const nextQuest = (save: AdventureSave) => quests.find(quest => !save.completed[quest.id]);
export const pageCount = (save: AdventureSave) => quests.filter(quest => quest.page && save.completed[quest.id]).length;
export function completeQuest(save: AdventureSave, quest: Quest, answers: string[]) {
  if (!questOpen(save, quest)) throw new Error("Finish the previous quest first.");
  const verdict = gradeQuest(quest, answers);
  if (!verdict.passed) return { save, verdict };
  const firstClear = !save.completed[quest.id];
  const xp = firstClear ? quest.xp : 0, coins = firstClear ? quest.coins : 0;
  return { save: { ...save, completed: { ...save.completed, [quest.id]: Math.max(save.completed[quest.id] ?? 0, verdict.stars) }, xp: save.xp + xp, coins: save.coins + coins }, verdict: { ...verdict, firstClear, xp, coins } };
}
export function equipCompanion(save: AdventureSave, id: string): AdventureSave {
  const companion = companions.find(item => item.id === id);
  if (!companion) throw new Error("Unknown companion.");
  if (save.owned.includes(id)) return { ...save, character: id };
  if (save.coins < companion.cost) throw new Error("Earn more sun coins to unlock this companion.");
  return { ...save, coins: save.coins - companion.cost, character: id, owned: [...save.owned, id] };
}
/** Guest storage is untrusted and versioned. Only a contiguous completed story is restored. */
export function restoreAdventure(value: unknown): AdventureSave {
  if (!value || typeof value !== "object" || !("version" in value) || value.version !== 1) return newAdventure();
  const data = value as Partial<AdventureSave>, save = newAdventure();
  for (const quest of quests) {
    const stars = data.completed?.[quest.id];
    if (stars !== 2 && stars !== 3) break;
    save.completed[quest.id] = stars; save.xp += quest.xp; save.coins += quest.coins;
  }
  for (const companion of companions.slice(1)) {
    if (Array.isArray(data.owned) && data.owned.includes(companion.id) && save.coins >= companion.cost) { save.owned.push(companion.id); save.coins -= companion.cost; }
  }
  if (data.character && save.owned.includes(data.character)) save.character = data.character;
  return save;
}
