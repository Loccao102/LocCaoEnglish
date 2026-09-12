import raw from "@/backend/internal/adventure/catalog.json";

export type Question = { kind: "choice" | "order" | "type" | "listen"; prompt: string; answer: string; options: string[]; note: string; passage: string };
export type Quest = { id: string; zoneId: string; title: string; brief: string; xp: number; coins: number; requires: string; page: boolean; questions: Question[] };
export type Zone = { id: string; name: string; guide: string; portrait: string; building: string; x: number; y: number; npcX: number; npcY: number; chapter: number; practice: string; intro: string; quests: Quest[] };
export const zones: Zone[] = raw.zones as Zone[];
export const quests = zones.flatMap(zone => zone.quests);
export const companions = raw.companions;
export const questById = (id: string) => quests.find(quest => quest.id === id);
export const zoneById = (id: string) => zones.find(zone => zone.id === id);
