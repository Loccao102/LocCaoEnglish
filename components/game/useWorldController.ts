"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { zones, type Zone } from "@/lib/game/catalog";
import { findPath, movePlayer, SPAWN, walkable, type Point } from "@/lib/game/world";
import { obstacles } from "@/lib/game/scenery";

export type WorldMotion = { velocity: Point; heading: number; speed: number; height: number; vertical: number; wave: number; landed: number };

/** Simulation and input are independent from the 3D renderer and React's render rate. */
export function useWorldController({ enabled, initial, onArrive, onSave }: {
  enabled: boolean; initial: Point; onArrive: (zone: Zone) => void; onSave: (position: Point) => void;
}) {
  const position = useRef<Point>(walkable(initial, obstacles) ? initial : SPAWN);
  const motion = useRef<WorldMotion>({ velocity: { x: 0, y: 0 }, heading: 0, speed: 0, height: 0, vertical: 0, wave: 0, landed: 0 });
  const keys = useRef(new Set<string>()), touch = useRef<Point>({ x: 0, y: 0 }), sprint = useRef(false);
  const cameraYaw = useRef(.30), jumpRequested = useRef(false);
  const path = useRef<Point[]>([]), destination = useRef<Zone | null>(null), nearbyRef = useRef<Zone | null>(null);
  const active = useRef(enabled), callbacks = useRef({ onArrive, onSave });
  active.current = enabled; callbacks.current = { onArrive, onSave };
  const [nearby, setNearby] = useState<Zone | null>(null), [walkingTo, setWalkingTo] = useState("");
  const [running, setRunning] = useState(false);
  const elapsed = useRef(0), savedAt = useRef(0), savedPosition = useRef({ ...position.current }), stuck = useRef(0);

  const stop = useCallback(() => {
    keys.current.clear(); touch.current = { x: 0, y: 0 }; path.current = []; destination.current = null;
    motion.current.velocity = { x: 0, y: 0 }; motion.current.speed = 0; jumpRequested.current = false;
    setWalkingTo(""); stuck.current = 0;
  }, []);
  const arrive = useCallback((zone: Zone) => {
    stop(); motion.current.wave = 1.5;
    motion.current.heading = Math.atan2(zone.npcX-position.current.x,zone.npcY-position.current.y);
    callbacks.current.onArrive(zone);
  }, [stop]);
  const walkTo = useCallback((point: Point, zone?: Zone) => {
    if (!active.current) return;
    if (zone && Math.hypot(position.current.x-zone.npcX,position.current.y-zone.npcY) < 66) { arrive(zone); return; }
    path.current = findPath(position.current,point,obstacles);
    destination.current = path.current.length ? zone || null : null;
    stuck.current = 0; setWalkingTo(path.current.length ? zone?.name || "destination" : "");
  }, [arrive]);
  const talk = useCallback(() => { if (active.current && nearbyRef.current) arrive(nearbyRef.current); }, [arrive]);
  const jump = useCallback(() => { if (active.current && motion.current.height <= .001) jumpRequested.current = true; }, []);
  const toggleRun = useCallback(() => { sprint.current = !sprint.current; setRunning(sprint.current); }, []);

  useEffect(() => {
    if (!enabled) { stop(); callbacks.current.onSave({ ...position.current }); }
  }, [enabled, stop]);
  useEffect(() => {
    const directions = new Set(["w","a","s","d","arrowup","arrowleft","arrowdown","arrowright"]);
    const down = (event: KeyboardEvent) => {
      if (!active.current || event.ctrlKey || event.metaKey || event.altKey || (event.target instanceof HTMLElement && event.target.closest("input,textarea,select"))) return;
      const key = event.key.toLowerCase();
      if (directions.has(key) || key === "shift") {
        event.preventDefault(); keys.current.add(key);
        if (directions.has(key)) { path.current=[];destination.current=null;setWalkingTo(""); }
      }
      if (key === "e" && !event.repeat) { event.preventDefault(); talk(); }
      if (event.code === "Space") { event.preventDefault(); if (!event.repeat) jump(); }
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.key.toLowerCase());
    const saveNow = () => callbacks.current.onSave({ ...position.current });
    window.addEventListener("keydown",down);window.addEventListener("keyup",up);window.addEventListener("blur",stop);window.addEventListener("pagehide",saveNow);
    return () => {window.removeEventListener("keydown",down);window.removeEventListener("keyup",up);window.removeEventListener("blur",stop);window.removeEventListener("pagehide",saveNow);};
  }, [stop, talk, jump]);

  const step = useCallback((delta: number) => {
    const dt = Math.min(.08,Math.max(0,delta)), m = motion.current;
    elapsed.current += dt; m.wave = Math.max(0,m.wave-dt); m.landed = Math.max(0,m.landed-dt);
    if (active.current) {
      const held = keys.current, yaw = cameraYaw.current;
      const screen = { x: Number(held.has("d")||held.has("arrowright"))-Number(held.has("a")||held.has("arrowleft"))+touch.current.x, y: Number(held.has("s")||held.has("arrowdown"))-Number(held.has("w")||held.has("arrowup"))+touch.current.y };
      let direction = { x: screen.x*Math.cos(yaw)+screen.y*Math.sin(yaw), y: -screen.x*Math.sin(yaw)+screen.y*Math.cos(yaw) };
      if ((screen.x||screen.y) && path.current.length) {path.current=[];destination.current=null;setWalkingTo("");}
      if (!screen.x&&!screen.y&&path.current.length) {
        while(path.current.length&&Math.hypot(path.current[0].x-position.current.x,path.current[0].y-position.current.y)<5)path.current.shift();
        if(path.current[0])direction={x:path.current[0].x-position.current.x,y:path.current[0].y-position.current.y};
        else {setWalkingTo("");m.velocity={x:0,y:0};}
      }
      const length=Math.hypot(direction.x,direction.y), speed=(held.has("shift")||sprint.current)?215:130;
      const target={x:length?direction.x/length*speed:0,y:length?direction.y/length*speed:0};
      const before={...position.current}, steps=Math.max(1,Math.ceil(dt/(1/60))), tick=dt/steps;
      for(let i=0;i<steps;i++){
        const ease=1-Math.exp(-(length?15:23)*tick);
        m.velocity.x+=(target.x-m.velocity.x)*ease;m.velocity.y+=(target.y-m.velocity.y)*ease;
        const actual=movePlayer(position.current,m.velocity,tick,obstacles,Math.hypot(m.velocity.x,m.velocity.y));
        if(Math.abs(actual.x-position.current.x)<.001)m.velocity.x=0;
        if(Math.abs(actual.y-position.current.y)<.001)m.velocity.y=0;
        position.current=actual;
        if(jumpRequested.current&&m.height<=.001){m.vertical=4.3;jumpRequested.current=false;}
        if(m.height>0||m.vertical>0){m.vertical-=12*tick;m.height+=m.vertical*tick;if(m.height<0){m.height=0;m.vertical=0;m.landed=.18;}}
      }
      const travelled=Math.hypot(position.current.x-before.x,position.current.y-before.y);
      m.speed=dt>0?travelled/dt:0;
      if(m.speed>3)m.heading=Math.atan2(position.current.x-before.x,position.current.y-before.y);
      if(path.current.length&&travelled<.01)stuck.current+=dt;else stuck.current=0;
      if(stuck.current>.4)stop();
      if(destination.current&&Math.hypot(position.current.x-destination.current.npcX,position.current.y-destination.current.npcY)<58)arrive(destination.current);
    }
    const pos=position.current;
    const nearest=zones.find(zone=>Math.hypot(pos.x-zone.npcX,pos.y-zone.npcY)<66)||null;
    if(nearest?.id!==nearbyRef.current?.id){nearbyRef.current=nearest;setNearby(nearest);}
    if(active.current&&elapsed.current-savedAt.current>2.5&&Math.hypot(pos.x-savedPosition.current.x,pos.y-savedPosition.current.y)>1){savedAt.current=elapsed.current;savedPosition.current={...pos};callbacks.current.onSave({...pos});}
  }, [arrive,stop]);

  return { position, motion, cameraYaw, nearby, walkingTo, touch, sprint, running, talk, jump, toggleRun, walkTo, step, stop };
}
export type WorldController = ReturnType<typeof useWorldController>;
