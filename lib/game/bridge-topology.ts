import { seedNumber, shuffled } from "./challenge";

export const BRIDGE_TOPOLOGY_VERSION = 2 as const;
export type BridgeTopologyLevel = "adventure" | "expert";

export type BridgeTopologyPuzzle = {
  entry: number;
  exit: number;
  ports: number[][];
  turns: number[];
  solution: number[];
  topologyVersion: typeof BRIDGE_TOPOLOGY_VERSION;
};

type BridgeTemplate = { entry: number; exit: number; route: number[] };

// N/E/S/W = 0/1/2/3. Every route is simple and starts/ends at a bank tile.
// Adventure teaches a route of at least five tiles; Challenge adds longer
// routes, including one that traverses the complete 3x3 grid.
const adventureTemplates: BridgeTemplate[] = [
  { entry: 0, exit: 2, route: [0, 3, 6, 7, 8] },
  { entry: 2, exit: 0, route: [6, 3, 0, 1, 2] },
  { entry: 0, exit: 1, route: [0, 3, 4, 1, 2, 5] },
  { entry: 1, exit: 2, route: [3, 0, 1, 4, 7, 8] },
  { entry: 2, exit: 1, route: [6, 3, 4, 1, 2, 5] },
  { entry: 1, exit: 0, route: [3, 6, 7, 4, 1, 2] },
];

const challengeTemplates: BridgeTemplate[] = [
  { entry: 0, exit: 2, route: [0, 1, 4, 3, 6, 7, 8] },
  { entry: 2, exit: 2, route: [6, 7, 4, 1, 2, 5, 8] },
  { entry: 0, exit: 0, route: [0, 3, 6, 7, 4, 5, 2] },
  { entry: 2, exit: 0, route: [6, 3, 0, 1, 4, 5, 2] },
  { entry: 1, exit: 0, route: [3, 0, 1, 4, 7, 8, 5, 2] },
  { entry: 0, exit: 2, route: [0, 1, 2, 5, 4, 3, 6, 7, 8] },
];

function withBankReflections(templates: BridgeTemplate[]): BridgeTemplate[] {
  const reflected = templates.map(template => ({
    entry: 2 - template.entry,
    exit: 2 - template.exit,
    route: template.route.map(tile => (2 - Math.floor(tile / 3)) * 3 + tile % 3),
  }));
  const seen = new Set<string>();
  return [...templates, ...reflected].filter(template => {
    const key = JSON.stringify(template);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const topologyTemplates = {
  adventure: withBankReflections(adventureTemplates),
  expert: withBankReflections(challengeTemplates),
};

const direction = (from: number, to: number) => {
  const row = Math.floor(from / 3), col = from % 3;
  const nextRow = Math.floor(to / 3), nextCol = to % 3;
  if (nextRow === row - 1 && nextCol === col) return 0;
  if (nextRow === row && nextCol === col + 1) return 1;
  if (nextRow === row + 1 && nextCol === col) return 2;
  if (nextRow === row && nextCol === col - 1) return 3;
  throw new Error("Bridge topology route must use neighbouring tiles.");
};

const addPort = (ports: number[][], tile: number, port: number) => {
  if (!ports[tile].includes(port)) ports[tile].push(port);
};

const addEdge = (ports: number[][], from: number, to: number) => {
  const port = direction(from, to);
  addPort(ports, from, port);
  addPort(ports, to, (port + 2) % 4);
};

export function bridgeTopologyTemplates(level: BridgeTopologyLevel): readonly BridgeTemplate[] {
  return topologyTemplates[level];
}

export function bridgeTopologyPuzzle(seed: number, round: number, level: BridgeTopologyLevel): BridgeTopologyPuzzle {
  const templates = bridgeTopologyTemplates(level);
  const order = shuffled(templates, seedNumber(`${seed}:bridge-topology:${level}`));
  const template = order[round % order.length];
  const routeSet = new Set(template.route);
  const ports = Array.from({ length: 9 }, () => [] as number[]);

  for (let i = 1; i < template.route.length; i++) addEdge(ports, template.route[i - 1], template.route[i]);
  addPort(ports, template.route[0], 3);
  addPort(ports, template.route[template.route.length - 1], 1);

  // Decoys are reciprocal edges between off-route tiles only. They cannot
  // touch the canonical route or expose a second bank connection.
  const decoyEdges: [number, number][] = [];
  for (let from = 0; from < 9; from++) {
    if (routeSet.has(from)) continue;
    const row = Math.floor(from / 3), col = from % 3;
    for (const to of [from + 1, from + 3]) {
      if (to >= 9 || routeSet.has(to)) continue;
      if (to === from + 1 && col === 2) continue;
      if (to === from + 3 && row === 2) continue;
      decoyEdges.push([from, to]);
    }
  }
  const decoys = shuffled(decoyEdges, seedNumber(`${seed}:bridge-decoys:${level}:${round}`));
  const decoyCount = Math.min(level === "expert" ? 3 : 2, decoys.length);
  for (let i = 0; i < decoyCount; i++) addEdge(ports, decoys[i][0], decoys[i][1]);
  for (const row of ports) row.sort((a, b) => a - b);

  return {
    entry: template.entry,
    exit: template.exit,
    ports,
    turns: Array(9).fill(0),
    solution: [...template.route],
    topologyVersion: BRIDGE_TOPOLOGY_VERSION,
  };
}
