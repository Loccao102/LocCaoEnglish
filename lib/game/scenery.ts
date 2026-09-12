import { zones } from "./catalog";
import { fieldChests } from "./discoveries";
import type { Obstacle } from "./world";

export const scenery = [
  { id: "bubble-tree", x: 206, y: 325, size: 120 },
  { id: "bubble-tree", x: 475, y: 218, size: 110 },
  { id: "bubble-tree", x: 740, y: 183, size: 102 },
  { id: "bubble-tree", x: 954, y: 550, size: 110 },
  { id: "bubble-tree", x: 414, y: 638, size: 105 },
  { id: "flower-bush", x: 211, y: 588, size: 70 },
  { id: "flower-bush", x: 691, y: 672, size: 72 },
  { id: "flower-bush", x: 965, y: 228, size: 58 },
  { id: "pebble-pair", x: 541, y: 434, size: 60 },
  { id: "leaf-planter", x: 757, y: 472, size: 66 },
  { id: "bench", x: 709, y: 373, size: 85 },
  { id: "sun-lamp", x: 312, y: 461, size: 68 },
  { id: "mailbox", x: 213, y: 533, size: 52 },
  { id: "signpost", x: 502, y: 524, size: 72 },
  { id: "book-stack", x: 577, y: 313, size: 54 },
  { id: "satchel", x: 473, y: 393, size: 45 },
  { id: "sun-lamp", x: 788, y: 613, size: 72 },
  { id: "chest-closed", x: 825, y: 249, size: 50 },
];
export const obstacles: Obstacle[] = [
  ...zones.map(zone => zone.id === "ielts" ? { x: zone.x, y: zone.y-22, rx: 32, ry: 32 } : { x: zone.x, y: zone.y - 22, rx: 49, ry: 28, shape: "box" as const }),
  { x: 632, y: 410, rx: 72, ry: 35, kind: "pond" },
  { x: 562, y: 580, rx: 16, ry: 16 }, { x: 702, y: 580, rx: 16, ry: 16 },
  ...fieldChests.map(chest=>({x:chest.x,y:chest.y,rx:10,ry:8})),
  ...scenery.filter(item => item.id === "bubble-tree").map(item => ({ x: item.x, y: item.y, rx: 9, ry: 9 })),
  ...scenery.filter(item => item.id === "bench").map(item => ({ x: item.x, y: item.y, rx: 20, ry: 8, shape: "box" as const })),
  ...scenery.filter(item => ["sun-lamp", "signpost", "mailbox"].includes(item.id)).map(item => ({ x: item.x, y: item.y, rx: 4, ry: 4 })),
  ...scenery.filter(item => item.id === "leaf-planter").map(item => ({ x: item.x, y: item.y, rx: 10, ry: 10 })),
];
