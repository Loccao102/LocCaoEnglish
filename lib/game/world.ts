export type Point = { x: number; y: number };
export type Obstacle = { x: number; y: number; rx: number; ry: number; shape?: "box"; kind?: "pond" };
export const WORLD = { width: 1200, height: 820 };
export const SPAWN: Point = { x: 343, y: 562 };
export const onBridge = (point: Point) => point.x >= 544 && point.x <= 720 && Math.abs(point.y-410) < 11;
export const shore: Point[] = [[168,225],[257,146],[406,116],[593,82],[760,101],[925,158],[1030,255],[1050,407],[1003,544],[892,627],[737,674],[532,682],[351,663],[222,601],[167,502],[155,351]].map(([x,y])=>({x,y}));
export function insideIsland(point: Point) {
  let inside = false;
  for (let i = 0, j = shore.length - 1; i < shore.length; j = i++) {
    const a = shore[i], b = shore[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
export function walkable(point: Point, obstacles: Obstacle[]) {
  return Number.isFinite(point.x) && Number.isFinite(point.y) && insideIsland(point) && obstacles.every(obstacle => obstacle.kind === "pond" && onBridge(point) ? true : obstacle.shape === "box" ? Math.abs(point.x-obstacle.x) > obstacle.rx+9 || Math.abs(point.y-obstacle.y) > obstacle.ry+9 : ((point.x-obstacle.x)/(obstacle.rx+9))**2 + ((point.y-obstacle.y)/(obstacle.ry+9))**2 > 1);
}
const segmentClear = (a: Point, b: Point, obstacles: Obstacle[]) => {
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x-a.x, b.y-a.y)/4));
  for (let i=0; i<=steps; i++) if (!walkable({ x: a.x+(b.x-a.x)*i/steps, y: a.y+(b.y-a.y)*i/steps }, obstacles)) return false;
  return true;
};
export function movePlayer(point: Point, direction: Point, delta: number, obstacles: Obstacle[], speed = 145): Point {
  const length = Math.hypot(direction.x, direction.y);
  if (!length) return point;
  const distance = speed * Math.min(.04, Math.max(0, delta));
  const dx = direction.x / length * distance, dy = direction.y / length * distance;
  let next = point;
  if (walkable({ x: point.x + dx, y: point.y }, obstacles)) next = { x: point.x + dx, y: point.y };
  if (walkable({ x: next.x, y: point.y + dy }, obstacles)) next = { x: next.x, y: point.y + dy };
  return next;
}
/** A* on a 16px navigation grid; diagonal corners cannot cut through obstacles. */
export function findPath(start: Point, target: Point, obstacles: Obstacle[]): Point[] {
  const step = 16, key = (p: Point) => `${p.x},${p.y}`;
  if (!walkable(start, obstacles) || !walkable(target, obstacles)) return [];
  const snap = (p: Point) => {
    const candidates: Point[] = [];
    for (let dx=-2; dx<=2; dx++) for (let dy=-2; dy<=2; dy++) candidates.push({ x: (Math.round(p.x/step)+dx)*step, y: (Math.round(p.y/step)+dy)*step });
    return candidates.sort((a,b) => Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y)).find(candidate => segmentClear(p,candidate,obstacles));
  };
  const goal = snap(target), origin = snap(start);
  if (!goal || !origin) return [];
  const open = new Map([[key(origin), origin]]), costs = new Map([[key(origin), 0]]), came = new Map<string, Point>();
  const closed = new Set<string>();
  for (let iterations=0; open.size && iterations<5000; iterations++) {
    let current = origin, best = Infinity;
    for (const [id, point] of open) { const score=(costs.get(id)??Infinity)+Math.hypot(goal.x-point.x,goal.y-point.y); if(score<best){best=score;current=point;} }
    const id=key(current); open.delete(id); closed.add(id);
    if (id===key(goal)) {
      const path: Point[]=[]; let at=current;
      while(key(at)!==key(origin)){path.unshift(at);const previous=came.get(key(at));if(!previous)break;at=previous;}
      path.unshift(origin); path.push(target);
      return path;
    }
    for(const dx of [-step,0,step])for(const dy of [-step,0,step]){
      if(!dx&&!dy)continue;const next={x:current.x+dx,y:current.y+dy},nextId=key(next);
      if(closed.has(nextId)||!walkable(next,obstacles)||!segmentClear(current,next,obstacles))continue;
      if(dx&&dy&&(!walkable({x:current.x+dx,y:current.y},obstacles)||!walkable({x:current.x,y:current.y+dy},obstacles)))continue;
      const cost=(costs.get(id)??0)+Math.hypot(dx,dy);
      if(cost<(costs.get(nextId)??Infinity)){costs.set(nextId,cost);came.set(nextId,current);open.set(nextId,next);}
    }
  }
  return [];
}
