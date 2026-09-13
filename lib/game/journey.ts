import { companions, zones } from "./catalog";
import { festivalById } from "./festival";
import type { FairSave } from "./fair-progress";
import type { AdventureSave } from "./progress";

// Each friend belongs to a chapter and a fair circle. All 24 have three concrete
// friendship milestones, derived from existing saves rather than a second XP counter.
const circles: Record<string, { chapter: string; game: string; friends: string[] }> = {
  meadow: { chapter: "training", game: "bubble-meadow", friends: ["mam", "nang", "na"] },
  garden: { chapter: "words", game: "little-garden", friends: ["com", "bui", "mit"] },
  pond: { chapter: "arena", game: "echo-pond", friends: ["giot", "hat", "gao"] },
  cafe: { chapter: "conversation", game: "tea-time", friends: ["moca", "bep", "duong"] },
  post: { chapter: "travel", game: "parcel-trail", friends: ["quyt", "dao", "me"] },
  clouds: { chapter: "ielts", game: "cloud-hop", friends: ["may", "cuon", "sen"] },
  paint: { chapter: "work", game: "colour-studio", friends: ["dau", "bo", "bong"] },
  bridge: { chapter: "work", game: "bridge-builder", friends: ["soi", "tim", "truc"] },
};
export function friendships(adventure: AdventureSave, fair: FairSave) {
  return companions.map(friend => {
    const circle = Object.values(circles).find(item => item.friends.includes(friend.id))!;
    const chapter = zones.find(zone => zone.id === circle.chapter)!, game = festivalById(circle.game)!;
    const milestones = [
      { label: `Help ${chapter.guide}: ${chapter.quests[0].title}`, complete: !!adventure.completed[chapter.quests[0].id], href: "/play" },
      { label: `Restore the Sun Page at ${chapter.name}`, complete: !!adventure.completed[chapter.quests[1].id], href: "/play" },
      { label: `Make a memory at ${game.name}`, complete: !!fair.games[game.id]?.stars, href: `/festival/${game.id}` },
    ];
    const hearts = milestones.filter(item => item.complete).length;
    return { friend, chapter, game, milestones, hearts, title: ["A new face", "A little hello", "Growing closer", "Friends in the sunshine"][hearts] };
  });
}
