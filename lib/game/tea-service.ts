export const teaIngredients = ["Tea", "Milk", "Honey", "Mint"];
export const teaStrengths = [
  { name: "Gentle", from: 1.5, to: 3 },
  { name: "Balanced", from: 3.5, to: 5 },
  { name: "Bold", from: 5.5, to: 7 },
] as const;
export const teaGuests = [
  { id: "mam", request: "Tea first, then milk and honey. A gentle cup for my garden break, please.", recipe: [0, 1, 2], strength: 0, thanks: "Just like a little patch of sunshine. My seedlings can wait a moment!" },
  { id: "may", request: "Tea, mint, then honey. Keep it balanced for my next flight!", recipe: [0, 3, 2], strength: 1, thanks: "That tastes like a fresh breeze. I have a new trail to draw!" },
  { id: "soi", request: "Tea, milk, then mint. A bold cup before I build another bridge.", recipe: [0, 1, 3], strength: 2, thanks: "Warm hands, steady stones. Thank you for remembering my order." },
  { id: "bong", request: "Tea, honey, then milk. Make it gentle for a quiet reading afternoon.", recipe: [0, 2, 1], strength: 0, thanks: "Soft and sweet. There is a seat beside me if you want to read." },
  { id: "nang", request: "Tea, honey, then mint. Balanced, please — I still have flowers to deliver!", recipe: [0, 2, 3], strength: 1, thanks: "A lovely little pause. I will bring a flower for your café!" },
  { id: "truc", request: "Tea, mint, then milk. I like it bold when I practise my music.", recipe: [0, 3, 1], strength: 2, thanks: "A warm cup and a new melody. This one is for you!" },
] as const;

export type TeaService = { guests: string[]; stage: "mixing" | "steeping" | "ready"; seconds: number; hint: boolean };
export const teaGuest = (service: TeaService | undefined, round: number) => service ? teaGuests.find(guest => guest.id === service.guests[Math.min(round, 2)]) : undefined;
export const teaStrength = (seconds: number) => teaStrengths.findIndex(band => seconds >= band.from && seconds <= band.to);

/** The run ID shuffles the queue once; its exact order is saved in checkpoints. */
export function createTeaService(runId: string): TeaService {
  let seed = 2166136261;
  for (const char of runId) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  const guests: string[] = teaGuests.map(guest => guest.id);
  for (let i = guests.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const next = seed % (i + 1);
    [guests[i], guests[next]] = [guests[next], guests[i]];
  }
  return { guests: guests.slice(0, 3), stage: "mixing", seconds: 0, hint: false };
}

export function validTeaService(value: unknown): value is TeaService {
  const tea = value as TeaService | null;
  return !!tea && Array.isArray(tea.guests) && tea.guests.length === 3 && new Set(tea.guests).size === 3 &&
    tea.guests.every(id => teaGuests.some(guest => guest.id === id)) &&
    ["mixing", "steeping", "ready"].includes(tea.stage) && Number.isFinite(tea.seconds) && tea.seconds >= 0 && tea.seconds <= 8 &&
    (tea.stage !== "mixing" || tea.seconds === 0) && typeof tea.hint === "boolean";
}
