"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API_URL } from "@/lib/api";
import { questById } from "@/lib/game/catalog";
import { completeQuest, equipCompanion, newAdventure, restoreAdventure, type AdventureSave, type Verdict } from "@/lib/game/progress";
import { SPAWN, type Point } from "@/lib/game/world";
import { discoveries } from "@/lib/game/discoveries";

type Meta = { position: Point; started: boolean; tracked: string; fieldNotes: string[] };
type Action = { kind: "complete"; questId: string; answers: string[] } | { kind: "equip"; character: string };
type Result = { save: AdventureSave; verdict?: Verdict };
const guestKey = "loccao.adventure.guest.v1";
const initialMeta = (): Meta => ({ position: { ...SPAWN }, started: false, tracked: "", fieldNotes: [] });

function readMeta(value: unknown): Meta {
  const data = value && typeof value === "object" ? value as Partial<Meta> : {};
  return {
    position: Number.isFinite(data.position?.x) && Number.isFinite(data.position?.y) ? data.position! : { ...SPAWN },
    started: data.started === true,
    tracked: typeof data.tracked === "string" && questById(data.tracked) ? data.tracked : "",
    fieldNotes: Array.isArray(data.fieldNotes) ? discoveries.filter(word=>data.fieldNotes!.includes(word.id)).map(word=>word.id) : [],
  };
}

export function useAdventure() {
  const [save, setSave] = useState<AdventureSave>(newAdventure);
  const [meta, setMeta] = useState<Meta>(initialMeta);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [identity, setIdentity] = useState("guest");
  const [name, setName] = useState("Adventurer");
  const [storageMode, setStorageMode] = useState("device");
  const [error, setError] = useState("");
  const [storageWarning, setStorageWarning] = useState("");
  const [busy, setBusy] = useState(false);
  const saveRef = useRef(save), metaRef = useRef(meta), keyRef = useRef(guestKey), tokenRef = useRef("");
  const busyRef = useRef(false), loadRef = useRef(0);

  const persist = useCallback((nextSave: AdventureSave, nextMeta: Meta) => {
    try {
      localStorage.setItem(keyRef.current, JSON.stringify(keyRef.current === guestKey ? { save: nextSave, ...nextMeta } : nextMeta));
      setStorageWarning("");
    } catch { setStorageWarning(keyRef.current === guestKey ? "Browser storage is unavailable. Keep this tab open to retain guest progress." : "Account progress is saved. This browser could not remember your position."); }
  }, []);

  const request = useCallback(async <T,>(path: string, body?: Action): Promise<T> => {
    const controller = new AbortController(), timeout = window.setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(`${API_URL}${path}`, {
        method: body ? "POST" : "GET", cache: "no-store", signal: controller.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenRef.current}` },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(response.status === 401 ? "Your session expired. Sign in again to load your adventure." : data.error || "The village server is unavailable. Please retry.");
      if (!data.save || data.save.version !== 1 || !data.save.completed || !Array.isArray(data.save.owned)) throw new Error("The server returned an unsupported save. Please retry after updating the game server.");
      return data;
    } catch (cause) {
      if (cause instanceof TypeError || (cause instanceof Error && cause.name === "AbortError")) throw new Error("Could not reach your saved adventure. Check your connection and retry.");
      throw cause;
    } finally { window.clearTimeout(timeout); }
  }, []);

  const load = useCallback(async (guest = false) => {
    const run = ++loadRef.current;
    setStatus("loading"); setError("");
    let token = "";
    try { token = guest ? "" : localStorage.getItem("loccao_token") || ""; } catch { /* Guest mode works in memory. */ }
    tokenRef.current = token;
    try {
      let nextSave: AdventureSave, nextMeta = initialMeta(), id = "guest", displayName = "Adventurer", mode = "device";
      if (token) {
        const data = await request<{ save: AdventureSave; playerId: string; displayName: string; storageMode: string }>("/v1/adventure");
        nextSave = data.save; id = data.playerId; displayName = data.displayName; mode = data.storageMode;
      } else { nextSave = newAdventure(); }
      if (run !== loadRef.current) return;
      keyRef.current = token ? `loccao.adventure.meta.${id}.v1` : guestKey;
      try {
        const stored = JSON.parse(localStorage.getItem(keyRef.current) || "null");
        nextMeta = readMeta(stored);
        if (!token) nextSave = restoreAdventure(stored?.save);
      } catch { setStorageWarning("A local save could not be read. This adventure is starting from a safe position."); }
      saveRef.current = nextSave; metaRef.current = nextMeta;
      setSave(nextSave); setMeta(nextMeta); setIdentity(id); setName(displayName); setStorageMode(mode); setStatus("ready");
    } catch (cause) { if (run === loadRef.current) { setError(cause instanceof Error ? cause.message : "Could not load adventure."); setStatus("error"); } }
  }, [request]);

  useEffect(() => { void load(); return () => { loadRef.current++; }; }, [load]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === "loccao_token") { void load(); return; }
      if (event.key === guestKey && identity === "guest" && event.newValue && !busyRef.current) {
        try { const latest = restoreAdventure(JSON.parse(event.newValue).save); saveRef.current = latest; setSave(latest); } catch { /* Keep the current valid save. */ }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [identity, load]);

  const updateMeta = useCallback((patch: Partial<Meta>) => {
    metaRef.current = { ...metaRef.current, ...patch };
    setMeta(metaRef.current); persist(saveRef.current, metaRef.current);
  }, [persist]);

  const collectWord = useCallback((id: string) => {
    if (discoveries.some(word=>word.id===id) && !metaRef.current.fieldNotes.includes(id)) updateMeta({ fieldNotes: [...metaRef.current.fieldNotes,id] });
  }, [updateMeta]);

  const act = useCallback(async (action: Action): Promise<Result> => {
    if (busyRef.current) throw new Error("Your previous action is still saving.");
    busyRef.current = true; setBusy(true);
    const identityVersion = loadRef.current;
    try {
      let result: Result;
      if (tokenRef.current) result = await request<Result>("/v1/adventure/actions", action);
      else if (action.kind === "equip") result = { save: equipCompanion(saveRef.current, action.character) };
      else {
        const quest = questById(action.questId);
        if (!quest) throw new Error("Unknown quest.");
        result = completeQuest(saveRef.current, quest, action.answers);
      }
      if (identityVersion !== loadRef.current) throw new Error("Your signed-in account changed. Open the adventure again to load its latest progress.");
      saveRef.current = result.save; setSave(result.save); persist(result.save, metaRef.current);
      return result;
    } finally { busyRef.current = false; setBusy(false); }
  }, [persist, request]);

  return { save, meta, status, identity, name, storageMode, error, storageWarning, busy, load, updateMeta, collectWord, act };
}
