import type { ArenaObject } from "./festival-session";

type Point = { x: number; z: number };
const clearance = 1.05;
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);

/** Walk around other interactables instead of collecting them en route to a click. */
export function fairWalkPath(start: Point, goal: Point, objects: ArenaObject[], targetId?: number): Point[] {
  const obstacles = objects.filter(object => object.id !== targetId);
  const clear = (a: Point, b: Point) => obstacles.every(obstacle => {
    const dx = b.x - a.x, dz = b.z - a.z, length = dx * dx + dz * dz;
    if (!length) return true;
    const projection = ((obstacle.x - a.x) * dx + (obstacle.z - a.z) * dz) / length;
    // The player may start at the edge of the object just collected. Allow leaving it.
    if (a === start && distance(a, obstacle) < clearance && projection <= 0) return true;
    const t = Math.max(0, Math.min(1, projection));
    return distance({ x: a.x + dx * t, z: a.z + dz * t }, obstacle) >= clearance;
  });
  if (clear(start, goal)) return [goal];
  const nodes: Point[] = [start, goal];
  for (const obstacle of obstacles) for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6;
    const point = { x: obstacle.x + Math.cos(angle) * 1.12, z: obstacle.z + Math.sin(angle) * 1.12 };
    if (Math.abs(point.x) <= 4.7 && point.z >= -3.5 && point.z <= 3.9 && obstacles.every(other => distance(point, other) >= clearance)) nodes.push(point);
  }
  const costs = nodes.map(() => Infinity), previous = nodes.map(() => -1), visited = new Set<number>();
  costs[0] = 0;
  while (visited.size < nodes.length) {
    let next = -1;
    for (let i = 0; i < nodes.length; i++) if (!visited.has(i) && (next < 0 || costs[i] < costs[next])) next = i;
    if (next < 0 || !Number.isFinite(costs[next])) break;
    if (next === 1) {
      const path: Point[] = [];
      for (let at = 1; at !== 0; at = previous[at]) path.unshift(nodes[at]);
      return path;
    }
    visited.add(next);
    for (let i = 1; i < nodes.length; i++) {
      if (visited.has(i)) continue;
      const cost = costs[next] + distance(nodes[next], nodes[i]);
      if (cost < costs[i] && clear(nodes[next], nodes[i])) { costs[i] = cost; previous[i] = next; }
    }
  }
  // A ground click inside another object's clearance has no safe path.
  return [];
}
