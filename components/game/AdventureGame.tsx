"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import GameArt from "@/components/GameArt";
import { questById, zones, zoneById, type Quest, type Zone } from "@/lib/game/catalog";
import { nextQuest, pageCount, questOpen } from "@/lib/game/progress";
import { scenery } from "@/lib/game/scenery";
import { useAdventure } from "./useAdventure";
import { useWorldController } from "./useWorldController";
import GameDialog from "./GameDialog";
import QuestChallenge from "./QuestChallenge";
import { AdventureBag, AdventureMap, QuestJournal } from "./AdventurePanels";

export default function AdventureGame({ initialMap = false }: { initialMap?: boolean }) {
  const adventure = useAdventure();
  if (adventure.status !== "ready") return <div className="adventure-game game-loading"><img src="/assets/sunlit-village/village-mark.svg" alt="" width="84" height="84"/><h1>{adventure.status === "loading" ? "Opening your story…" : "Your adventure is waiting"}</h1>{adventure.status === "error" && <><p role="alert">{adventure.error}</p><div className="game-actions"><button className="game-button" onClick={() => void adventure.load()}>Retry connection</button><Link className="game-button secondary" href="/account">Sign in</Link></div><button className="game-text-button" onClick={() => void adventure.load(true)}>Play a separate guest adventure</button></>}</div>;
  return <AdventureRuntime key={adventure.identity} adventure={adventure} initialMap={initialMap}/>;
}

function AdventureRuntime({ adventure, initialMap }: { adventure: ReturnType<typeof useAdventure>; initialMap: boolean }) {
  const { save, meta, updateMeta } = adventure;
  const [title, setTitle] = useState(true), [paused, setPaused] = useState(false);
  const [panel, setPanel] = useState<"" | "journal" | "map" | "bag">("");
  const [dialogue, setDialogue] = useState<Zone | null>(null), [challenge, setChallenge] = useState<Quest | null>(null);
  const [navigation, setNavigation] = useState<Zone | null>(null), [tracked, setTracked] = useState(meta.tracked);
  const current = questById(tracked), active = current && questOpen(save, current) && !save.completed[current.id] ? current : nextQuest(save);
  const activeZone = active ? zoneById(active.zoneId) : null;
  const pages = pageCount(save), enabled = !title && !paused && !panel && !dialogue && !challenge;
  const world = useWorldController({ enabled, initial: meta.position, onArrive: zone => setDialogue(zone), onSave: position => updateMeta({ position }) });

  useEffect(() => {
    if (navigation && enabled) { world.walkTo({ x: navigation.npcX, y: navigation.npcY }, navigation); setNavigation(null); }
  }, [navigation, enabled, world.walkTo]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !title) { event.preventDefault(); if (paused) setPaused(false); else if (panel) setPanel(""); else if (dialogue) setDialogue(null); else setPaused(true); }
      if (event.target instanceof HTMLElement && event.target.closest("input,textarea,select")) return;
      if (!enabled || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key.toLowerCase() === "m") { event.preventDefault(); setPanel("map"); }
      if (event.key.toLowerCase() === "j") { event.preventDefault(); setPanel("journal"); }
      if (event.key.toLowerCase() === "b") { event.preventDefault(); setPanel("bag"); }
    };
    const blur = () => { if (!title) setPaused(true); };
    const visibility = () => { if (document.hidden) blur(); };
    window.addEventListener("keydown", key); window.addEventListener("blur", blur); document.addEventListener("visibilitychange", visibility);
    return () => { window.removeEventListener("keydown", key); window.removeEventListener("blur", blur); document.removeEventListener("visibilitychange", visibility); };
  }, [title, paused, panel, dialogue, enabled]);

  function begin() { setTitle(false); updateMeta({ started: true }); if (initialMap) setPanel("map"); }
  function track(quest: Quest) { setTracked(quest.id); updateMeta({ tracked: quest.id }); setPanel(""); const zone = zoneById(quest.zoneId); if (zone) setNavigation(zone); }
  function accept(quest: Quest) { setDialogue(null); setTracked(quest.id); updateMeta({ tracked: quest.id }); setChallenge(quest); }
  function done() { setChallenge(null); setTracked(""); updateMeta({ tracked: "" }); }
  const dialogueQuest = dialogue?.quests.find(quest => !save.completed[quest.id] && questOpen(save, quest));

  return <div className="adventure-game">
    <div className="game-world-ui" inert={!enabled}>
      <div ref={world.viewport} className="game-viewport" aria-label="Sunlit Village exploration area" onPointerDown={event => { if (event.button === 0 && !(event.target as HTMLElement).closest("button")) world.clickGround(event.clientX, event.clientY); }}>
        <div className="game-scene" ref={world.scene}>
          <img className="game-terrain" src="/assets/sunlit-village/village-map.svg" alt="" draggable={false}/>
          <span className="sea-caption">THE SUNLIT SHORES</span>
          {scenery.map((item, index) => <div key={index} className="world-prop" style={{ left: item.x, top: item.y, width: item.size, zIndex: item.y }}><GameArt id={item.id}/></div>)}
          {zones.map(zone => <div key={zone.id} className="world-building" data-unlocked={questOpen(save, zone.quests[0])} style={{ left: zone.x, top: zone.y, zIndex: zone.y }}><button onClick={() => world.walkTo({ x: zone.npcX, y: zone.npcY }, zone)} aria-label={`Visit ${zone.name}`}><GameArt id={zone.building}/><span className="world-place-name">{!questOpen(save, zone.quests[0]) ? "◇ " : save.completed[zone.quests[1].id] ? "☀ " : ""}{zone.name}</span></button></div>)}
          {zones.map(zone => <button key={zone.id} className="world-npc" style={{ left: zone.npcX, top: zone.npcY, zIndex: zone.npcY }} onClick={() => world.walkTo({ x: zone.npcX, y: zone.npcY }, zone)} aria-label={`Talk to ${zone.guide} at ${zone.name}`}><GameArt id={zone.portrait}/><span className="npc-marker" data-active={activeZone?.id === zone.id}>{activeZone?.id === zone.id ? "!" : save.completed[zone.quests[1].id] ? "✓" : "···"}</span><small>{zone.guide}</small></button>)}
          {activeZone && <div className="quest-beacon" style={{ left: activeZone.npcX, top: activeZone.npcY }}/>} 
          <div ref={world.player} className="world-player" data-testid="adventure-player" data-moving="false"><span className="player-shadow"/><GameArt id={save.character}/><span className="player-tag">YOU</span></div>
        </div>
      </div>
      <header className="game-hud"><div className="player-hud"><GameArt id={save.character}/><div><strong>{adventure.name}</strong><span>Level {Math.floor(save.xp/150)+1} · <b data-testid="adventure-xp">{save.xp}</b> adventure XP</span><div className="hud-xp"><i style={{ width: `${save.xp % 150 / 1.5}%` }}/></div></div></div><div className="story-hud"><span>THE SEVEN SUN PAGES</span><strong>☀ {pages} <small>/ 7 pages</small></strong></div><div className="hud-tools"><span className="coin-pill">☀ <b data-testid="adventure-coins">{save.coins}</b></span><button className="game-icon-button" onClick={() => setPaused(true)} aria-label="Pause game">Ⅱ</button></div></header>
      <div className="quest-tracker"><span>{pages === 7 ? "STORY COMPLETE" : `CHAPTER ${activeZone?.chapter || 1} · MAIN QUEST`}</span><strong>{active?.title || "A brighter village, thanks to you."}</strong><button onClick={() => active && track(active)} disabled={!active}>{activeZone ? `Find ${activeZone.guide} · ${activeZone.name} ↗` : "Explore, revisit your friends and keep learning."}</button></div>
      <div className="game-save-note" role="status">{adventure.storageWarning || (adventure.busy ? "Saving…" : adventure.identity === "guest" ? "Guest · saved on this device" : adventure.storageMode === "memory" ? "Server session · resets when the server restarts" : "Account · progress saved to server")}</div>
      <div className="movement-hint"><kbd>W A S D</kbd> / arrows to move <span>·</span> click a place to walk</div>
      <div className="game-dpad" role="group" aria-label="Movement controls">{[{ label: "Move up", icon: "↑", x: 0, y: -1 }, { label: "Move left", icon: "←", x: -1, y: 0 }, { label: "Move down", icon: "↓", x: 0, y: 1 }, { label: "Move right", icon: "→", x: 1, y: 0 }].map((direction, i) => <button key={direction.label} className={`direction-${i}`} aria-label={direction.label} onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); world.touch.current = { x: direction.x, y: direction.y }; }} onPointerUp={() => { world.touch.current = { x: 0, y: 0 }; }} onPointerCancel={() => { world.touch.current = { x: 0, y: 0 }; }} onLostPointerCapture={() => { world.touch.current = { x: 0, y: 0 }; }}>{direction.icon}</button>)}</div>
      <div className="interaction-slot">{world.nearby ? <button className="game-button talk-button" onClick={world.talk}><kbd>E</kbd> Talk to {world.nearby.guide}</button> : world.walkingTo ? <span className="walking-notice">Walking to {world.walkingTo}…</span> : null}</div>
      <nav className="game-toolbar" aria-label="Adventure tools"><button onClick={() => setPanel("journal")}><span>▤</span>Journal<kbd>J</kbd></button><button onClick={() => setPanel("map")}><span>⌘</span>Map<kbd>M</kbd></button><button onClick={() => setPanel("bag")}><GameArt id="satchel"/>Bag<kbd>B</kbd></button></nav>
    </div>
    {title && <div className="game-title-screen"><div className="title-leaf">☀</div><p className="title-brand">LOCCAO ENGLISH PRESENTS</p><h1>The Seven<br/><em>Sun Pages</em></h1><p className="title-description">A little village. A lost story.<br/>An English adventure that begins with you.</p><button className="game-button title-start" onClick={begin}>{meta.started ? "Continue adventure" : "Begin adventure"}<span>→</span></button><p className="title-save">{adventure.identity === "guest" ? "Play as a guest · progress saves on this device" : `Welcome back, ${adventure.name} · account save`}</p><div className="title-links"><Link href="/account">{adventure.identity === "guest" ? "Sign in for account saves" : "Your account"}</Link><Link href="/art-studio">Meet the village</Link></div><div className="title-companions"><GameArt id="may"/><GameArt id="mam"/><GameArt id="soi"/></div><div className="title-corner">SUNLIT VILLAGE · CHAPTERS 01—07</div></div>}
    {dialogue && !paused && <GameDialog title={dialogue.name} onClose={() => setDialogue(null)} className="npc-dialog"><div className="npc-dialog-intro"><GameArt id={dialogue.portrait}/><div><span className="game-overline">{dialogue.guide} · CHAPTER {dialogue.chapter}</span><p>{dialogue.intro}</p></div></div>{!questOpen(save, dialogue.quests[0]) ? <div className="locked-story"><strong>This chapter is still waiting.</strong><p>Restore the Sun Page in {zones[dialogue.chapter - 2]?.name} to begin these quests.</p><button className="game-button" onClick={() => { setDialogue(null); if (active) track(active); }}>Find my next quest →</button></div> : <><div className="npc-quests">{dialogue.quests.map(quest => <div key={quest.id} className="npc-quest"><span>{save.completed[quest.id] ? "✓" : "!"}</span><div><h3>{quest.title}</h3><p>{quest.brief}</p><small>{save.completed[quest.id] ? `${"★".repeat(save.completed[quest.id])} · First-clear reward collected` : `${quest.xp} XP · ${quest.coins} sun coins${quest.page ? " · 1 Sun Page" : ""}`}</small></div><button className={`game-button ${save.completed[quest.id] ? "secondary" : ""}`} disabled={!questOpen(save, quest)} onClick={() => accept(quest)}>{save.completed[quest.id] ? "Replay" : quest === dialogueQuest ? "Start quest" : "Locked"}</button></div>)}</div>{save.completed[dialogue.quests[1].id] && <Link href={dialogue.practice} className="game-text-button">More English practice at this place ↗</Link>}</>}</GameDialog>}
    {challenge && <QuestChallenge key={challenge.id} quest={challenge} hidden={paused} finalPage={pages === 7} onPause={() => setPaused(true)} onDone={done} onComplete={async answers => { const result = await adventure.act({ kind: "complete", questId: challenge.id, answers }); if (!result.verdict) throw new Error("No result received. Please retry."); return result.verdict; }}/>} 
    {panel === "journal" && !paused && <QuestJournal save={save} onClose={() => setPanel("")} onTrack={track}/>}
    {panel === "map" && !paused && <AdventureMap save={save} position={world.position.current} onClose={() => setPanel("")} onTravel={zone => { setPanel(""); setNavigation(zone); }}/>}
    {panel === "bag" && !paused && <AdventureBag save={save} busy={adventure.busy} onClose={() => setPanel("")} onEquip={async character => { await adventure.act({ kind: "equip", character }); }}/>}
    {paused && <GameDialog title="A moment in the sunshine" className="pause-dialog"><GameArt id={save.character}/><p>Your adventure is paused. {challenge ? "Your current answers are kept while you stay here." : "Your position and progress have been saved."}</p><button className="game-button" onClick={() => setPaused(false)}>Resume adventure</button>{challenge && <button className="game-button secondary" disabled={adventure.busy} onClick={() => { setChallenge(null); setPaused(false); }}>Leave this challenge · discard current answers</button>}<button className="game-button secondary" disabled={adventure.busy} onClick={() => { setPaused(false); setTitle(true); setPanel(""); setDialogue(null); setChallenge(null); }}>Return to title</button><Link className="game-text-button" href="/camp">Learning journal & practice ↗</Link><p className="game-caption">Move: WASD / arrow keys or touch controls<br/>Interact: E · Journal: J · Map: M · Bag: B · Pause: Esc</p></GameDialog>}
  </div>;
}
