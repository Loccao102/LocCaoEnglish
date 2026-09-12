import type { WorldState } from "@/lib/api";

// Art placement only. The API remains the source of progress, rewards and access.
export const villagePlaces = [
  { id: "training", art: "training-school", x: 20.5, y: 58, guide: "mam", title: "Training Grounds", route: "/learn", description: "Daily quests, Recovery and the Arcade build your core stats." },
  { id: "travel", art: "travel-station", x: 32.5, y: 34, guide: "may", title: "Travel District", route: "/travel", description: "Find your way through airports, hotels and city journeys." },
  { id: "conversation", art: "conversation-cafe", x: 53, y: 64, guide: "nang", title: "Conversation District", route: "/conversation", description: "Turn little words into everyday conversations." },
  { id: "work", art: "work-studio", x: 73, y: 47, guide: "soi", title: "Work District", route: "/work", description: "Make yourself understood, from stand-ups to delivery." },
  { id: "words", art: "word-greenhouse", x: 51.5, y: 22, guide: "nang", title: "Word Network", route: "/word-graph", description: "Grow your vocabulary through connected meanings." },
  { id: "arena", art: "arena-amphitheatre", x: 82, y: 26, guide: "soi", title: "Battle Arena", route: "/social", description: "Practice fast recall alongside other learners." },
  { id: "ielts", art: "ielts-lighthouse", x: 70, y: 9, guide: "mam", title: "IELTS Tower", route: "/ielts", description: "Build your four English skills, one floor at a time." },
] as const;

export const villagePreview: WorldState[] = villagePlaces.map(place => ({
  id: place.id, title: place.title, description: place.description, route: place.route,
  icon: "", unlocked: false, progress: 0, unlockText: "Connect your account to see your unlock requirements.",
}));
export function worldArt(id: string) { return villagePlaces.find(place => place.id === id)?.art ?? "coral-cottage"; }

export const villageDecor = [
  ["bubble-tree", 18, 25, 10], ["bubble-tree", 25, 20, 8], ["bubble-tree", 40, 14, 8],
  ["bubble-tree", 87, 43, 10], ["bubble-tree", 91, 48, 8], ["bubble-tree", 70, 69, 9],
  ["bubble-tree", 77, 66, 8], ["bubble-tree", 38, 64, 8], ["bubble-tree", 14, 47, 8],
  ["coral-cottage", 27, 75, 10], ["lagoon-townhouse", 37, 78, 10],
  ["flower-bush", 43, 39, 6], ["flower-bush", 59, 76, 6], ["pebble-pair", 86, 68, 6],
  ["sun-lamp", 28, 54, 5], ["signpost", 42, 54, 5], ["bench", 48, 45, 6],
  ["mailbox", 29, 67, 4], ["ferry", 16, 82, 11], ["footbridge", 58, 47, 8],
  ["leaf-planter", 65, 34, 5], ["mam", 32, 58, 7],
] as const;
