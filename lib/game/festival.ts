import catalog from "@/backend/internal/fair/catalog.json";
export type FestivalKind = "bubble" | "garden" | "echo" | "tea" | "parcel" | "hop" | "colour" | "bridge";
export type FestivalGame = { id: string; kind: FestivalKind; name: string; host: string; colour: string; skill: string; description: string; instructions: string; x: number; y: number; rounds: number; memory: string };
export const festivalGames = catalog as FestivalGame[];
export const festivalById=(id:string)=>festivalGames.find(game=>game.id===id);
export const festivalShore = [[215,817],[325,752],[540,736],[760,750],[951,799],[1012,914],[958,1036],[741,1095],[486,1093],[271,1042],[192,934]].map(([x,y])=>({x,y}));
export const festivalGate={x:620,y:735};
