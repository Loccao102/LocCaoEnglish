"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Cosmetic, equipCosmetic, getProgression, ProgressionState } from "@/lib/api";

type PlayerPoint = { x: number; y: number };
type Direction = "up" | "down" | "left" | "right";
type SpotKind = "home" | "cafe" | "store" | "park" | "library" | "station" | "studio";

type TownSpot = {
  id: string;
  label: string;
  kind: SpotKind;
  x: number;
  y: number;
  worldId?: string;
  specialRoute?: string;
};

const TOWN_SPOTS: TownSpot[] = [
  { id: "home", label: "Home", kind: "home", x: 18, y: 31, specialRoute: "/" },
  { id: "cafe", label: "Café", kind: "cafe", x: 72, y: 27, worldId: "conversation", specialRoute: "/missions/cafe" },
  { id: "store", label: "Market", kind: "store", x: 77, y: 65, worldId: "words" },
  { id: "park", label: "Park", kind: "park", x: 19, y: 67, worldId: "arena" },
  { id: "library", label: "Library", kind: "library", x: 48, y: 18, worldId: "ielts" },
  { id: "station", label: "Station", kind: "station", x: 48, y: 77, worldId: "travel" },
  { id: "studio", label: "Club", kind: "studio", x: 88, y: 45, worldId: "work" },
];

const COLLIDERS = [
  { x: 18, y: 31, r: 5.2 },
  { x: 72, y: 27, r: 5.5 },
  { x: 77, y: 65, r: 5.2 },
  { x: 48, y: 18, r: 5.4 },
  { x: 48, y: 77, r: 4.5 },
  { x: 88, y: 45, r: 5.3 },
  { x: 35.5, y: 40.5, r: 6.4 },
];

function distance(a: PlayerPoint, b: PlayerPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function hitsCollider(point: PlayerPoint) {
  return COLLIDERS.some((collider) => Math.hypot(point.x - collider.x, point.y - collider.y) < collider.r);
}

export default function WorldMap() {
  const router = useRouter();
  const [state, setState] = useState<ProgressionState | null>(null);
  const [error, setError] = useState("");
  const [equipping, setEquipping] = useState("");
  const [player, setPlayer] = useState<PlayerPoint>({ x: 50, y: 57 });
  const [direction, setDirection] = useState<Direction>("down");
  const [walking, setWalking] = useState(false);
  const walkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = () =>
    getProgression()
      .then(setState)
      .catch((e) => setError(e instanceof Error ? e.message : "Progression unavailable"));

  useEffect(() => {
    void load();
    return () => {
      if (walkTimer.current) clearTimeout(walkTimer.current);
    };
  }, []);

  const playableWorlds = useMemo(
    () => state?.worlds.filter((world) => world.id !== "training") ?? [],
    [state],
  );

  const currentQuest = useMemo(
    () => playableWorlds.find((world) => world.unlocked && world.progress < 100) ?? playableWorlds.find((world) => world.unlocked),
    [playableWorlds],
  );

  const locations = useMemo(
    () =>
      TOWN_SPOTS.map((spot) => {
        const world = spot.worldId ? playableWorlds.find((item) => item.id === spot.worldId) : undefined;
        const isCafe = spot.id === "cafe";
        const unlocked = Boolean(spot.specialRoute && !spot.worldId) || isCafe || Boolean(world?.unlocked);
        return {
          ...spot,
          world,
          unlocked,
          route: spot.specialRoute ?? world?.route ?? "#",
          subtitle: isCafe
            ? "Breakfast Run · AI role-play"
            : spot.id === "home"
              ? "Safe zone"
              : world
                ? world.unlocked
                  ? `${world.progress}% explored · ${world.title}`
                  : world.unlockText
                : "Coming soon",
        };
      }),
    [playableWorlds],
  );

  const nearby = useMemo(() => {
    const ordered = locations
      .map((location) => ({ location, distance: distance(player, location) }))
      .sort((a, b) => a.distance - b.distance);
    return ordered[0]?.distance <= 9 ? ordered[0].location : null;
  }, [locations, player]);

  const questLocation = useMemo(() => {
    if (!currentQuest) return null;
    return locations.find((location) => location.world?.id === currentQuest.id) ?? null;
  }, [currentQuest, locations]);

  const move = useCallback((dx: number, dy: number) => {
    if (Math.abs(dx) > Math.abs(dy)) setDirection(dx < 0 ? "left" : "right");
    else if (dy !== 0) setDirection(dy < 0 ? "up" : "down");
    setWalking(true);
    if (walkTimer.current) clearTimeout(walkTimer.current);
    walkTimer.current = setTimeout(() => setWalking(false), 170);

    setPlayer((point) => {
      const candidate = {
        x: Math.max(7, Math.min(93, point.x + dx)),
        y: Math.max(12, Math.min(86, point.y + dy)),
      };
      return hitsCollider(candidate) ? point : candidate;
    });
  }, []);

  const interact = useCallback(() => {
    if (!nearby) return;
    if (nearby.unlocked && nearby.route !== "#") router.push(nearby.route);
  }, [nearby, router]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "e"].includes(key)) {
        event.preventDefault();
      }
      if (key === "w" || key === "arrowup") move(0, -1.8);
      if (key === "s" || key === "arrowdown") move(0, 1.8);
      if (key === "a" || key === "arrowleft") move(-1.8, 0);
      if (key === "d" || key === "arrowright") move(1.8, 0);
      if (key === "e") interact();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [interact, move]);

  async function equip(item: Cosmetic) {
    if (!item.unlocked || item.equipped) return;
    setEquipping(item.id);
    try {
      setState(await equipCosmetic(item.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not equip reward");
    } finally {
      setEquipping("");
    }
  }

  if (!state) {
    return (
      <div className="world-game-shell world-game-loading">
        <div className="cloud cloud-a" />
        <div className="cloud cloud-b" />
        <section>
          <span>ENGLISH ADVENTURE</span>
          <h1>{error ? "The town is taking a break." : "Building your neighborhood…"}</h1>
          <p>{error || "Loading quests, places and your player progress."}</p>
        </section>
      </div>
    );
  }

  const unlocked = playableWorlds.filter((world) => world.unlocked).length;
  const pct = Math.min(100, Math.round((state.xpIntoLevel / Math.max(1, state.xpForNext)) * 100));

  return (
    <div className="world-game-shell">
      <section className="game-hud" aria-label="Player status">
        <div className="player-hud">
          <span className="hud-avatar">CL</span>
          <div>
            <div className="hud-row">
              <strong>LV. {String(state.level).padStart(2, "0")}</strong>
              <small>{state.xpIntoLevel}/{state.xpForNext} XP</small>
            </div>
            <div className="game-progress"><i style={{ width: `${pct}%` }} /></div>
          </div>
        </div>

        <div className="quest-hud">
          <small>CURRENT QUEST</small>
          <strong>Breakfast Run · Café</strong>
          <span>Walk to Maya’s café, order breakfast, then practise a real conversation.</span>
        </div>
      </section>

      <section className="world-game-stage" aria-label="Bright 2.5D English adventure town">
        <div className="world-sky-decoration sun" />
        <div className="world-sky-decoration cloud-one" />
        <div className="world-sky-decoration cloud-two" />

        <div className="island-shadow" />
        <div className="island-ground" />
        <div className="town-road road-horizontal" />
        <div className="town-road road-vertical" />
        <div className="town-road road-north" />
        <div className="town-plaza" />

        <div className="pond" aria-hidden="true"><i/><i/><i/></div>
        <div className="flower-patch flower-a" aria-hidden="true">✿ ✿ ✿</div>
        <div className="flower-patch flower-b" aria-hidden="true">✿ ✿</div>
        <div className="tree-prop tree-a" aria-hidden="true"><i/><b/></div>
        <div className="tree-prop tree-b" aria-hidden="true"><i/><b/></div>
        <div className="tree-prop tree-c" aria-hidden="true"><i/><b/></div>
        <div className="tree-prop tree-d" aria-hidden="true"><i/><b/></div>
        <div className="bench-prop" aria-hidden="true"><i/><b/></div>
        <div className="lamp-prop lamp-a" aria-hidden="true"><i/><b/></div>
        <div className="lamp-prop lamp-b" aria-hidden="true"><i/><b/></div>

        {locations.map((location) => {
          const isQuest = location.id === "cafe" || questLocation?.id === location.id;
          const isNear = nearby?.id === location.id;
          return (
            <button
              type="button"
              key={location.id}
              className={`town-location ${location.kind} ${location.unlocked ? "open" : "locked"} ${isQuest ? "quest-active" : ""} ${isNear ? "near-player" : ""}`}
              style={{ left: `${location.x}%`, top: `${location.y}%` }}
              onClick={() => {
                if (location.unlocked && location.route !== "#") router.push(location.route);
              }}
              aria-label={`${location.label}: ${location.subtitle}`}
            >
              {isQuest && <span className="quest-beacon">!</span>}
              <span className="poi-shadow" />
              {location.kind === "park" ? (
                <span className="park-object">
                  <i className="park-tree one" />
                  <i className="park-tree two" />
                  <i className="park-bench" />
                </span>
              ) : location.kind === "station" ? (
                <span className="station-object"><i/><b/><em/></span>
              ) : (
                <span className="poi-building">
                  <i className="building-roof" />
                  <i className="building-front" />
                  <i className="building-side" />
                  <i className="building-door" />
                  <i className="building-window left" />
                  <i className="building-window right" />
                  <i className="building-sign">{location.kind === "cafe" ? "CAFÉ" : location.kind === "store" ? "SHOP" : location.kind === "library" ? "BOOKS" : location.kind === "studio" ? "CLUB" : ""}</i>
                </span>
              )}
              <span className="location-label">
                <strong>{location.label}</strong>
                <small>{location.unlocked ? location.subtitle : `🔒 ${location.subtitle}`}</small>
              </span>
            </button>
          );
        })}

        <div className="town-npc town-npc-maya" aria-label="Maya the barista">
          <span className="town-npc-bubble">☕ Breakfast quest!</span>
          <i className="town-npc-shadow" />
          <span className="town-npc-head"><i/></span>
          <span className="town-npc-body" />
          <span className="town-npc-apron" />
          <b>Maya</b>
        </div>
        <div className="town-npc town-npc-walker" aria-hidden="true">
          <i className="town-npc-shadow" />
          <span className="town-npc-head"><i/></span>
          <span className="town-npc-body" />
        </div>

        <div
          className={`game-player direction-${direction} ${walking ? "walking" : ""}`}
          style={{ left: `${player.x}%`, top: `${player.y}%` }}
          aria-label="Your player"
        >
          <i className="player-ground-shadow" />
          <span className="player-head"><i/></span>
          <span className="player-body" />
          <span className="player-arm left" />
          <span className="player-arm right" />
          <span className="player-leg left" />
          <span className="player-leg right" />
        </div>

        <div className={`interaction-toast ${nearby ? "visible" : ""}`} aria-live="polite">
          {nearby ? (
            <>
              <span className="keycap">E</span>
              <div>
                <strong>{nearby.unlocked ? `Enter ${nearby.label}` : `${nearby.label} is locked`}</strong>
                <small>{nearby.subtitle}</small>
              </div>
            </>
          ) : (
            <>
              <span className="keycap">WASD</span>
              <div>
                <strong>Explore the town</strong>
                <small>Buildings and the pond have collision. Walk close to a place to interact.</small>
              </div>
            </>
          )}
        </div>

        <div className="mobile-controls" aria-label="Movement controls">
          <button type="button" onClick={() => move(0, -3)}>↑</button>
          <button type="button" onClick={() => move(-3, 0)}>←</button>
          <button type="button" onClick={interact}>E</button>
          <button type="button" onClick={() => move(3, 0)}>→</button>
          <button type="button" onClick={() => move(0, 3)}>↓</button>
        </div>

        <div className="town-status">
          <small>SUNNY TOWN · MORNING</small>
          <strong>{unlocked}/{playableWorlds.length} districts open</strong>
        </div>
      </section>

      <section className="game-journal">
        <div className="journal-heading">
          <div>
            <span>ADVENTURE JOURNAL</span>
            <h2>Your world keeps growing as your English does.</h2>
          </div>
          <Link href="/" className="journal-home-link">← Player camp</Link>
        </div>

        <div className="journal-world-grid">
          {playableWorlds.map((world, index) => (
            <article className={`journal-world-card ${world.unlocked ? "open" : "locked"}`} key={world.id}>
              <span>{world.unlocked ? world.icon : "🔒"}</span>
              <small>DISTRICT {String(index + 1).padStart(2, "0")}</small>
              <h3>{world.title}</h3>
              <p>{world.description}</p>
              <div className="game-progress"><i style={{ width: `${world.progress}%` }} /></div>
              {world.unlocked ? <Link href={world.route}>Enter district →</Link> : <b>{world.unlockText}</b>}
            </article>
          ))}
        </div>

        <div className="journal-detail-grid">
          <article className="journal-panel">
            <div className="journal-panel-title"><div><small>TROPHY SHELF</small><h3>Achievements</h3></div><b>{state.achievements.filter((a) => a.unlocked).length}/{state.achievements.length}</b></div>
            <div className="achievement-list">
              {state.achievements.map((achievement) => (
                <div className={`achievement ${achievement.unlocked ? "earned" : ""}`} key={achievement.id}>
                  <span className="achievement-icon">{achievement.icon}</span>
                  <div>
                    <strong>{achievement.title}</strong>
                    <p>{achievement.description}</p>
                    <div className="progress"><i style={{ width: `${Math.min(100, (achievement.progress / Math.max(1, achievement.target)) * 100)}%` }} /></div>
                    <small>{achievement.progress}/{achievement.target}{achievement.rewardCosmetic ? ` · reward: ${achievement.rewardCosmetic}` : ""}</small>
                  </div>
                  <b>{achievement.unlocked ? "✓" : ""}</b>
                </div>
              ))}
            </div>
          </article>

          <article className="journal-panel">
            <div className="journal-panel-title"><div><small>BACKPACK</small><h3>Wearable rewards</h3></div></div>
            <div className="inventory-grid">
              {state.inventory.map((item) => (
                <button
                  key={item.id}
                  disabled={!item.unlocked || equipping === item.id}
                  onClick={() => void equip(item)}
                  className={`cosmetic ${item.unlocked ? "unlocked" : "locked"} ${item.equipped ? "equipped" : ""}`}
                >
                  <span>{item.slot.toUpperCase()}</span>
                  <strong>{item.name}</strong>
                  <p>{item.description}</p>
                  <small>{item.equipped ? "EQUIPPED" : item.unlocked ? equipping === item.id ? "Equipping…" : "Equip" : "Locked"}</small>
                </button>
              ))}
            </div>
          </article>
        </div>

        <article className="journal-panel boss-journal">
          <div className="journal-panel-title"><div><small>BOSS GATES</small><h3>Proof before the fight</h3></div></div>
          {state.bosses.map((boss) => (
            <div className={`boss-gate ${boss.unlocked ? "open" : "locked"}`} key={boss.id}>
              <div>
                <strong>{boss.title}</strong>
                <p>{boss.cleared ? `Cleared · +${boss.rewardXp} XP` : boss.unlocked ? "Gate open. The final mission is ready." : "Create real evidence in every checkpoint to open this boss."}</p>
              </div>
              <div className="boss-checkpoints">
                {boss.checkpoints.map((checkpoint) => (
                  <span key={checkpoint.id} className={checkpoint.complete ? "complete" : ""}>{checkpoint.complete ? "✓" : "○"} {checkpoint.skill}</span>
                ))}
              </div>
              {boss.unlocked ? <Link href={boss.route} className="game-cta">{boss.cleared ? "Replay boss" : "Fight boss →"}</Link> : <span className="game-lock-pill">LOCKED</span>}
            </div>
          ))}
        </article>
      </section>
    </div>
  );
}
