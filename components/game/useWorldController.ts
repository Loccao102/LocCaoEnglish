"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { zones, type Zone } from "@/lib/game/catalog";
import { findPath, movePlayer, SPAWN, walkable, WORLD, type Point } from "@/lib/game/world";
import { obstacles } from "@/lib/game/scenery";

export function useWorldController({ enabled, initial, onArrive, onSave }: {
  enabled: boolean; initial: Point; onArrive: (zone: Zone) => void; onSave: (position: Point) => void;
}) {
  const viewport = useRef<HTMLDivElement>(null), scene = useRef<HTMLDivElement>(null), player = useRef<HTMLDivElement>(null);
  const position = useRef<Point>(walkable(initial, obstacles) ? initial : SPAWN);
  const keys = useRef(new Set<string>()), touch = useRef<Point>({ x: 0, y: 0 });
  const path = useRef<Point[]>([]), destination = useRef<Zone | null>(null);
  const camera = useRef({ x: 0, y: 0, zoom: 1 });
  const callbacks = useRef({ onArrive, onSave });
  callbacks.current = { onArrive, onSave };
  const [nearby, setNearby] = useState<Zone | null>(null), [walkingTo, setWalkingTo] = useState("");
  const nearbyId = useRef("");

  const stop = useCallback(() => {
    keys.current.clear(); touch.current = { x: 0, y: 0 }; path.current = []; destination.current = null; setWalkingTo("");
  }, []);
  const walkTo = useCallback((point: Point, zone?: Zone) => {
    if (!enabled) return;
    if (zone && Math.hypot(position.current.x - zone.npcX, position.current.y - zone.npcY) < 76) { callbacks.current.onArrive(zone); return; }
    const route = findPath(position.current, point, obstacles);
    path.current = route; destination.current = route.length ? zone || null : null;
    setWalkingTo(route.length ? zone?.name || "destination" : "");
  }, [enabled]);
  const talk = useCallback(() => { if (enabled && nearby) { stop(); callbacks.current.onArrive(nearby); } }, [enabled, nearby, stop]);
  const clickGround = useCallback((clientX: number, clientY: number) => {
    const rect = viewport.current?.getBoundingClientRect(); if (!rect) return;
    walkTo({ x: (clientX - rect.left - camera.current.x) / camera.current.zoom, y: (clientY - rect.top - camera.current.y) / camera.current.zoom });
  }, [walkTo]);

  useEffect(() => {
    if (!enabled) { stop(); callbacks.current.onSave(position.current); }
    const directions = new Set(["w", "a", "s", "d", "arrowup", "arrowleft", "arrowdown", "arrowright"]);
    const down = (event: KeyboardEvent) => {
      if (!enabled || event.ctrlKey || event.metaKey || event.altKey || (event.target instanceof HTMLElement && event.target.closest("input,textarea,select"))) return;
      const key = event.key.toLowerCase();
      if (directions.has(key)) { event.preventDefault(); keys.current.add(key); path.current = []; destination.current = null; setWalkingTo(""); }
      if (key === "e" && !event.repeat) { event.preventDefault(); talk(); }
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.key.toLowerCase());
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", stop);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", stop); };
  }, [enabled, stop, talk]);

  useEffect(() => {
    let frame = 0, previous = 0, lastSaved = 0, lastSavedPosition = position.current, stuckFor = 0;
    const animate = (time: number) => {
      const delta = previous ? (time - previous) / 1000 : 0; previous = time;
      let direction: Point = { x: 0, y: 0 };
      if (enabled) {
        const held = keys.current;
        direction = { x: Number(held.has("d") || held.has("arrowright")) - Number(held.has("a") || held.has("arrowleft")) + touch.current.x, y: Number(held.has("s") || held.has("arrowdown")) - Number(held.has("w") || held.has("arrowup")) + touch.current.y };
        if ((direction.x || direction.y) && path.current.length) { path.current = []; destination.current = null; setWalkingTo(""); }
        if (!direction.x && !direction.y && path.current.length) {
          while (path.current.length && Math.hypot(path.current[0].x-position.current.x, path.current[0].y-position.current.y) < 6) path.current.shift();
          if (path.current[0]) direction = { x: path.current[0].x-position.current.x, y: path.current[0].y-position.current.y };
          else setWalkingTo("");
        }
        const before = position.current;
        position.current = movePlayer(before, direction, delta, obstacles);
        if (path.current.length && Math.hypot(position.current.x-before.x, position.current.y-before.y) < .01) stuckFor += Math.min(delta, .04);
        else stuckFor = 0;
        if (stuckFor > .5) { stop(); stuckFor = 0; }
        if (player.current) {
          const moving = Math.hypot(position.current.x-before.x, position.current.y-before.y) > .01;
          player.current.dataset.moving = String(moving);
          if (direction.x) player.current.style.setProperty("--facing", direction.x < 0 ? "-1" : "1");
        }
        if (destination.current && Math.hypot(position.current.x-destination.current.npcX, position.current.y-destination.current.npcY) < 60) {
          const zone = destination.current; stop(); callbacks.current.onArrive(zone);
        }
      } else if (player.current) player.current.dataset.moving = "false";
      const pos = position.current;
      const nearest = zones.find(zone => Math.hypot(pos.x-zone.npcX, pos.y-zone.npcY) < 76) || null;
      if ((nearest?.id || "") !== nearbyId.current) { nearbyId.current = nearest?.id || ""; setNearby(nearest); }
      if (player.current) { player.current.style.left = `${pos.x}px`; player.current.style.top = `${pos.y}px`; player.current.style.zIndex = String(Math.round(pos.y)); player.current.dataset.x = pos.x.toFixed(1); player.current.dataset.y = pos.y.toFixed(1); }
      const bounds = viewport.current?.getBoundingClientRect();
      if (bounds && scene.current) {
        const zoom = bounds.width < 700 ? 1.25 : Math.max(1.12, Math.min(1.5, bounds.height / 660));
        const x = Math.min(0, Math.max(bounds.width-WORLD.width*zoom, bounds.width/2-pos.x*zoom));
        const y = Math.min(0, Math.max(bounds.height-WORLD.height*zoom, bounds.height/2-pos.y*zoom));
        camera.current = { x, y, zoom };
        scene.current.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
      }
      if (enabled && time-lastSaved > 2500 && Math.hypot(pos.x-lastSavedPosition.x, pos.y-lastSavedPosition.y) > 1) {
        lastSaved = time; lastSavedPosition = { ...pos }; callbacks.current.onSave({ ...pos });
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    const saveNow = () => callbacks.current.onSave({ ...position.current });
    window.addEventListener("pagehide", saveNow);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("pagehide", saveNow); };
  }, [enabled, stop]);

  return { viewport, scene, player, position, nearby, walkingTo, touch, talk, walkTo, clickGround, stop };
}
