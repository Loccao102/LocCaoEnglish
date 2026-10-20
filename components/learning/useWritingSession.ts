"use client";

import {useEffect, useRef, useState} from "react";
import {getAuthToken} from "@/lib/session";
import {APIError} from "@/lib/api";
import {getWriting, listWriting, runWriting, writingRequest, type WritingAttempt, type WritingOperation} from "@/lib/writing";

type Recovery = {schema: 1; owner: string; id?: string; text: string; baseVersion: number; pending?: WritingOperation};
function readRecovery(raw: string, owner: string): Recovery {
  const r = JSON.parse(raw) as Recovery;
  if (r.schema !== 1 || r.owner !== owner || typeof r.text !== "string" || [...r.text].length > 12000 || !Number.isInteger(r.baseVersion) || r.baseVersion < 0 || r.id !== undefined && typeof r.id !== "string") throw Error("Invalid draft");
  const p = r.pending;
  if (p?.kind === "submit" && (!Number.isInteger(p.input?.generation) || p.input.generation < 0)) throw Error("Invalid evaluation retry");
  if (p && (typeof p !== "object" || !["start", "save", "submit"].includes(p.kind) || !p.input || (p.kind === "start"
    ? typeof p.input.requestId !== "string" || !/^[a-zA-Z0-9-]{16,64}$/.test(p.input.requestId) || p.input.parentId !== undefined && typeof p.input.parentId !== "string"
    : p.id !== r.id || p.input.essay !== r.text || p.input.version !== r.baseVersion || typeof p.input.rulesVersion !== "string"))) throw Error("Invalid pending submission");
  return r;
}

export default function useWritingSession(token: string) {
  const [attempt, setAttempt] = useState<WritingAttempt | null>(null);
  const [items, setItems] = useState<WritingAttempt[]>([]);
  const [recovery, setRecovery] = useState<Recovery | null>(null);
  const [busy, setBusy] = useState(true), [error, setError] = useState("");
  const [storageWarning, setStorageWarning] = useState(""), [corrupt, setCorrupt] = useState(false), [conflict, setConflict] = useState(false);
  const active = useRef(false), lock = useRef(false), key = useRef("");
  const saved = useRef<Recovery | null>(null);
  const current = () => active.current && getAuthToken() === token;
  function persist(next: Recovery) {
    if (!current()) return;
    saved.current = next; setRecovery(next);
    try {localStorage.setItem(key.current, JSON.stringify(next));}
    catch {setStorageWarning("This browser cannot keep a recovery copy. Save your draft to your account before leaving; keep a separate copy if the connection fails.");}
  }
  function apply(a: WritingAttempt, local = saved.current) {
    if (!current() || !local) return;
    setAttempt(a); setItems(old => [a, ...old.filter(x => x.id !== a.id)].slice(0, 50));
    if (local.pending?.kind === "submit" && local.id === a.id && a.status === "draft") return;
    if (local.id === a.id && local.text !== a.essay) {
      setConflict(a.status !== "draft" || local.baseVersion !== a.version); return;
    }
    setConflict(false);
    persist({schema: 1, owner: local.owner, id: a.id, text: a.essay, baseVersion: a.version});
  }
  async function load(ignoreLocal = false) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const me = await writingRequest<{user: {id: string}}>(token, "/v1/me");
      if (!current()) return;
      key.current = `loccao.writing.v1:${me.user.id}`;
      let local: Recovery = saved.current || {schema: 1, owner: me.user.id, text: "", baseVersion: 0};
      if (!ignoreLocal && !saved.current) {
        let raw: string | null = null;
        try {raw = localStorage.getItem(key.current);} catch {setStorageWarning("Browser recovery storage is unavailable. Save your draft to your account before leaving.");}
        if (raw) {
          try {local = readRecovery(raw, me.user.id);}
          catch {setCorrupt(true); setError("The browser recovery copy cannot be read. It has been kept untouched. Load your account copy to continue."); return;}
        }
      }
      const list = await listWriting(token); if (!current()) return;
      setItems(list.items);
      if (ignoreLocal) local = {schema: 1, owner: me.user.id, text: "", baseVersion: 0};
      saved.current = local; setRecovery(local); setCorrupt(false);
      const linked = new URLSearchParams(window.location.search).get("attempt");
      const safeLink = !ignoreLocal && linked && !local.pending && (!local.id || list.items.find(x => x.id === local.id)?.essay === local.text);
      if (safeLink) {local = {...local, id: undefined}; saved.current = local;}
      const id = safeLink ? linked : ignoreLocal ? list.items[0]?.id : local.pending?.kind === "start"
        ? list.items.find(x => local.pending?.kind === "start" && x.requestId === local.pending.input.requestId)?.id
        : local.id || linked || (!local.pending ? list.items[0]?.id : undefined);
      if (id) {const a = await getWriting(token, id); if (current()) {apply(a, local); if (safeLink) {const url = new URL(window.location.href); url.searchParams.delete("attempt"); window.history.replaceState(null, "", url);}}}
      else {setAttempt(null); if (!local.pending) persist(local);}
    } catch (e) {if (current()) setError(e instanceof Error ? e.message : "Could not load Writing practice.");}
    finally {lock.current = false; if (current()) setBusy(false);}
  }
  useEffect(() => {active.current = true; void load(); return () => {active.current = false;};}, [token]); // owner-keyed mount

  async function execute(op: WritingOperation) {
    if (lock.current || !saved.current || corrupt || !current()) return;
    lock.current = true; setBusy(true); setError("");
    persist({...saved.current, pending: op});
    try {
      const a = await runWriting(token, op);
      if (current()) {
        if (op.kind === "start") saved.current = {...saved.current!, id: a.id, text: a.essay, baseVersion: a.version};
        apply(a);
      }
    } catch (e) {
      if (current()) {
        // A strict validation rejection made no write. Let the learner fix the
        // preserved draft; uncertain network/server errors retain exact retry.
        if (e instanceof APIError && e.status === 400 && saved.current) {
          const {pending: _rejected, ...draft} = saved.current;
          persist(draft);
        }
        setError(e instanceof Error ? e.message : "The request was not confirmed. Retry the same saved request.");
      }
    }
    finally {lock.current = false; if (current()) setBusy(false);}
  }
  const input = () => ({version: recovery!.baseVersion, essay: recovery!.text, rulesVersion: attempt!.rulesVersion});
  function edit(text: string) {if (recovery && !lock.current && !recovery.pending && !conflict && !corrupt && attempt?.status === "draft" && [...text].length <= 12000) persist({...recovery, text});}
  function save() {if (attempt && recovery && !conflict) void execute({kind: "save", id: attempt.id, input: input()});}
  function submit() {if (attempt && recovery && recovery.text === attempt.essay && !conflict) void execute({kind: "submit", id: attempt.id, input: {...input(), generation: attempt.generation}});}
  function start(parentId?: string) {if (recovery && !recovery.pending) void execute({kind: "start", input: {requestId: crypto.randomUUID(), ...(parentId ? {parentId} : {})}});}
  function useAccountCopy() {if (attempt && recovery) {setConflict(false); setError(""); apply(attempt, {...recovery, id: undefined});}}
  async function open(id: string) {
    if (lock.current || recovery?.pending || corrupt || recovery?.text !== attempt?.essay && !!attempt) return;
    lock.current = true; setBusy(true); setError("");
    try {const a = await getWriting(token, id); if (current() && saved.current) apply(a, {...saved.current, id: undefined});}
    catch (e) {if (current()) setError(e instanceof Error ? e.message : "Could not open this revision.");}
    finally {lock.current = false; if (current()) setBusy(false);}
  }
  return {attempt, items, recovery, busy, error, storageWarning, corrupt, conflict, edit, save, submit, start, open, useAccountCopy,
    reload: () => void load(), discardCorrupt: () => void load(true), retry: () => recovery?.pending && void execute(recovery.pending)};
}
