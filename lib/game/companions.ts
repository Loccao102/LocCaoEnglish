import { companions } from "./catalog";

export type Companion = (typeof companions)[number];
export type CompanionDesign = Companion["design"];
export const companionById = (id: string) => companions.find(friend => friend.id === id) || companions[0];
export const companionForPath = (path: string) => companions
  .filter(friend => path === friend.route || path.startsWith(`${friend.route}/`))
  .sort((a, b) => b.route.length - a.route.length)[0];
export const companionFamilies = Array.from(new Set(companions.map(friend => friend.family)));
