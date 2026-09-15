"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { AUTH_EVENT, getAuthToken } from "@/lib/session";
import { getMe, login, logout, register } from "@/lib/api";

export default function AuthPanel({ onAuthChange }: { onAuthChange?: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("Guest adventures save on this device. Account adventures are kept separately.");
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let active=true, version=0;
    const refresh=()=>{
      const run=++version;
      if(!getAuthToken()){setSignedIn(false);setMessage("Guest adventures save on this device. Account adventures are kept separately.");return;}
      void getMe().then(result=>{if(active&&run===version){setSignedIn(true);setMessage(`Signed in as ${result.user.displayName}. Continue to load your account adventure.`);}}).catch(()=>{if(active&&run===version){setSignedIn(false);setMessage("Sign in again to reconnect your account adventure.");}});
    };
    const storage=(event:StorageEvent)=>{if(event.key==="loccao_token"||event.key===null)refresh();};
    refresh();window.addEventListener(AUTH_EVENT,refresh);window.addEventListener("storage",storage);
    return()=>{active=false;window.removeEventListener(AUTH_EVENT,refresh);window.removeEventListener("storage",storage);};
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      const result = mode === "login" ? await login(email, password) : await register(email, password, displayName);
      setSignedIn(true); setMessage(`Signed in as ${result.user.displayName}. Your account adventure is ready.`); onAuthChange?.();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Authentication failed"); }
    finally { setBusy(false); }
  }

  return (
    <section className="auth-card">
      <div className="auth-copy"><span className="eyebrow">YOUR ADVENTURE ACCOUNT</span><h1>A home for your story.</h1><p>Sign in to continue your account’s quests, Sun Pages, companions and friendship memories. Your guest adventure stays on this device and is kept separate.</p></div>
      <form onSubmit={submit} className="auth-form">
        {!signedIn && <>
        <div className="auth-tabs"><button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Sign in</button><button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Create account</button></div>
        {mode === "register" && <label>Display name<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required /></label>}
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required /></label>
        <button className="button primary wide" disabled={busy}>{busy ? "Working…" : mode === "login" ? "Sign in" : "Create account"}</button>
        </>}
        {signedIn && <Link className="button primary wide" href="/journey">Continue account adventure →</Link>}
        <button type="button" className="text-button" onClick={() => { try { logout(); setSignedIn(false); setMessage("Signed out. Return to the village to continue your separate guest adventure."); onAuthChange?.(); } catch(error) { setMessage(error instanceof Error ? error.message : "Could not sign out."); } }}>Play as guest</button>
        <p className="auth-message" role="status">{message}</p>
      </form>
    </section>
  );
}
