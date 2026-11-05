"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { AUTH_EVENT, getAuthToken, setAuthToken } from "@/lib/session";
import { getMe, logout } from "@/lib/api";
import { requestAuthentication } from "@/lib/account-auth";

export default function AuthPanel({ onAuthChange }: { onAuthChange?: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("Guest adventures save on this device. Account adventures are kept separately.");
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const active = useRef(false), generation = useRef(0), pending = useRef<number | null>(null);
  const current = (request: number, token: string) => active.current && request === generation.current && token === getAuthToken();

  useEffect(() => {
    active.current = true;
    const refresh=()=>{
      const run=++generation.current, token=getAuthToken();
      pending.current=null; setBusy(false); setPassword(""); setSignedIn(false);
      if(!token){setMessage("Guest adventures save on this device. Account adventures are kept separately.");return;}
      setMessage("Checking your signed-in account…");
      void getMe(token).then(result=>{if(current(run,token)){setSignedIn(true);setMessage(`Signed in as ${result.user.displayName}. Continue to load your account adventure.`);}}).catch(()=>{if(current(run,token)){setSignedIn(false);setMessage("Sign in again to reconnect your account adventure.");}});
    };
    const storage=(event:StorageEvent)=>{if(event.key==="loccao_token"||event.key===null)refresh();};
    refresh();window.addEventListener(AUTH_EVENT,refresh);window.addEventListener("storage",storage);
    return()=>{active.current=false;generation.current++;pending.current=null;window.removeEventListener(AUTH_EVENT,refresh);window.removeEventListener("storage",storage);};
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pending.current !== null) return;
    const request = ++generation.current, token = getAuthToken();
    pending.current = request; setBusy(true);
    try {
      const result = await requestAuthentication(mode, { email, password, displayName });
      if (!current(request, token)) return;
      setAuthToken(result.token);
      setSignedIn(true); setMessage(`Signed in as ${result.user.displayName}. Your account adventure is ready.`); onAuthChange?.();
    } catch (error) { if (current(request, token)) setMessage(error instanceof Error ? error.message : "Authentication failed"); }
    finally { if (pending.current === request) { pending.current=null; if(active.current){setBusy(false);setPassword("");} } }
  }

  function playAsGuest() {
    // Invalidate first: a pending login must not undo a later guest choice.
    generation.current++; pending.current=null; setBusy(false); setPassword("");
    try { logout(); setSignedIn(false); setMessage("Signed out. Return to the village to continue your separate guest adventure."); onAuthChange?.(); }
    catch(error) { setMessage(error instanceof Error ? error.message : "Could not sign out."); }
  }

  return (
    <section className="auth-card">
      <div className="auth-copy"><span className="eyebrow">YOUR ADVENTURE ACCOUNT</span><h1>A home for your story.</h1><p>Sign in to continue your account’s quests, Sun Pages, companions and friendship memories. Your guest adventure stays on this device and is kept separate.</p></div>
      <form onSubmit={submit} className="auth-form">
        {!signedIn && <>
        <div className="auth-tabs"><button type="button" disabled={busy} className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Sign in</button><button type="button" disabled={busy} className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Create account</button></div>
        {mode === "register" && <label>Display name<input disabled={busy} value={displayName} onChange={(e) => setDisplayName(e.target.value)} required /></label>}
        <label>Email<input disabled={busy} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Password<input disabled={busy} type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required /></label>
        <button className="button primary wide" disabled={busy}>{busy ? "Working…" : mode === "login" ? "Sign in" : "Create account"}</button>
        </>}
        {signedIn && <Link className="button primary wide" href="/journey">Continue account adventure →</Link>}
        <button type="button" className="text-button" onClick={playAsGuest}>Play as guest</button>
        <p className="auth-message" role="status">{message}</p>
      </form>
    </section>
  );
}
