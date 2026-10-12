"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, type BossState, type ProgressionState } from "@/lib/api";
import { AUTH_EVENT, getAuthToken } from "@/lib/session";
import { claimBoss, evaluateBoss, getMissionReceipt, MISSION_RULES, type BossEvaluation, type MissionReceipt } from "@/lib/missions";

type Draft = { version: string; messages: string[]; text: string; pending?: "evaluate" | "claim" };
const fresh = (): Draft => ({ version: MISSION_RULES, messages: [], text: "" });
function read(key: string): Draft | null {
  const raw = localStorage.getItem(key); if (!raw) return null;
  const invalid = () => new Error("This saved dialogue could not be read. Its data has been kept; restart this mission to begin again.");
  let d: Draft;
  try { d = JSON.parse(raw) as Draft; } catch { throw invalid(); }
  if (!d || d.version !== MISSION_RULES || !Array.isArray(d.messages) || d.messages.length > 24 ||
    d.messages.some(m => typeof m !== "string" || !m.trim() || new TextEncoder().encode(m).length > 1024) ||
    typeof d.text !== "string" || d.text.length > 1024 || d.pending && !["claim", "evaluate"].includes(d.pending)) {
    throw invalid();
  }
  return d;
}

export default function useMissionConversation(bossId: string) {
  const [boss, setBoss] = useState<BossState | null>(null), [draft, setDraft] = useState<Draft>(fresh);
  const [verdict, setVerdict] = useState<BossEvaluation | null>(null), [receipt, setReceipt] = useState<MissionReceipt | null>(null);
  const [busy, setBusy] = useState(true), [error, setError] = useState(""), [storageWarning, setStorageWarning] = useState("");
  const [signedIn, setSignedIn] = useState(false), [brokenDraft, setBrokenDraft] = useState(false);
  const seq = useRef(0), locked = useRef(false), data = useRef<Draft>(fresh());
  const identity = useRef({ token: "", key: "" });
  const memoryDraft = useRef<{ key: string; value: Draft } | null>(null);
  const current = (n: number, token: string) => n === seq.current && token === getAuthToken();
  function keep(next: Draft) {
    data.current = next; setDraft(next);
    memoryDraft.current = { key: identity.current.key, value: next };
    try { localStorage.setItem(identity.current.key, JSON.stringify(next)); setStorageWarning(""); }
    catch { setStorageWarning("Browser storage is unavailable. Keep this tab open until you save your chapter."); }
  }
  const open = useCallback(async () => {
    const n = ++seq.current, token = getAuthToken(); locked.current = true;
    setBusy(true); setBoss(null); setVerdict(null); setReceipt(null); setError(""); setBrokenDraft(false); setStorageWarning("");
    setDraft(fresh()); data.current = fresh(); setSignedIn(!!token);
    if (!token) { locked.current = false; setBusy(false); return; }
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const me = await apiFetch<{ user: { id: string } }>("/v1/me", { headers });
      if (!current(n, token)) return;
      identity.current = { token, key: `loccao.mission.v2.${me.user.id}.${bossId}` };
      const state = await apiFetch<ProgressionState>("/v1/player/progression", { headers });
      if (!current(n, token)) return;
      const found = state.bosses.find(b => b.id === bossId) || null; setBoss(found);
      if (found?.cleared) {
        const saved = await getMissionReceipt(bossId, token); if (!current(n, token)) return;
        setReceipt(saved); setVerdict(saved.evaluation || null); keep({ ...fresh(), messages: saved.messages });
      } else {
        let saved: Draft;
        const cached = memoryDraft.current?.key === identity.current.key ? memoryDraft.current.value : null;
        try { const stored = read(identity.current.key); saved = cached || stored || fresh(); }
        catch (e) {
          if (e instanceof Error && e.message.includes("saved dialogue")) { setBrokenDraft(true); throw e; }
          saved = cached || fresh(); setStorageWarning("Browser storage is unavailable. Keep this tab open until you save your chapter.");
        }
        keep(saved);
        if (found?.unlocked) {
          const evaluation = await evaluateBoss(bossId, saved.messages, token); if (!current(n, token)) return;
          setVerdict(evaluation);
          if (saved.pending === "evaluate") keep({ ...saved, pending: undefined });
        }
      }
    } catch (e) { if (current(n, token)) setError(e instanceof Error ? e.message : "Could not load this mission."); }
    finally { if (current(n, token)) { locked.current = false; setBusy(false); } }
  }, [bossId]);
  useEffect(() => {
    void open(); const changed = () => { void open(); };
    const storage = (e: StorageEvent) => { if (e.key === "loccao_token" || e.key === null) changed(); };
    window.addEventListener(AUTH_EVENT, changed); window.addEventListener("storage", storage);
    return () => { seq.current++; window.removeEventListener(AUTH_EVENT, changed); window.removeEventListener("storage", storage); };
  }, [open]);

  async function submit(kind: "evaluate" | "claim", messages: string[]) {
    if (locked.current || !boss?.unlocked || boss.cleared || identity.current.token !== getAuthToken()) return;
    const n = seq.current, token = identity.current.token;
    locked.current = true; setBusy(true); setError("");
    keep({ ...data.current, messages, text: "", pending: kind });
    try {
      if (kind === "claim") {
        const result = await claimBoss(bossId, messages, token); if (!current(n, token)) return;
        setBoss(result.progression.bosses.find(b => b.id === bossId) || null); setReceipt(result.receipt);
        setVerdict(result.receipt.evaluation || null);
      } else {
        const result = await evaluateBoss(bossId, messages, token); if (!current(n, token)) return; setVerdict(result);
      }
      keep({ ...data.current, pending: undefined });
    } catch (e) { if (current(n, token)) setError(e instanceof Error ? e.message : "Could not save. Retry the same dialogue."); }
    finally { if (current(n, token)) { locked.current = false; setBusy(false); } }
  }
  function send() {
    const text = data.current.text.trim();
    if (!text || data.current.pending || verdict?.complete || data.current.messages.length >= 24) return;
    if (new TextEncoder().encode(text).length > 1024) { setError("Keep each reply within 1024 bytes. Shorten this reply and try again."); return; }
    void submit("evaluate", [...data.current.messages, text]);
  }
  function edit(text: string) {
    if (locked.current || data.current.pending || boss?.cleared || identity.current.token !== getAuthToken()) return;
    keep({ ...data.current, text });
  }
  function restart() {
    if (locked.current || data.current.pending === "claim" || boss?.cleared || !identity.current.key || identity.current.token !== getAuthToken()) return;
    keep(fresh()); setBrokenDraft(false); void open();
  }
  return { boss, draft, verdict, receipt, busy, error, storageWarning, signedIn, brokenDraft, edit, send, restart, reload: open,
    claim: () => { if (verdict?.complete && !data.current.pending) void submit("claim", data.current.messages); },
    retry: () => { if (data.current.pending) void submit(data.current.pending, data.current.messages); },
  };
}
