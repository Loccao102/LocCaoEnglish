"use client";

import { FormEvent, useState } from "react";
import { login, logout, register } from "@/lib/api";

export default function AuthPanel() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("You can use the whole app in demo mode without an account.");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      const result = mode === "login" ? await login(email, password) : await register(email, password, displayName);
      setMessage(`Signed in as ${result.user.displayName}. Your attempts will now use this account.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Authentication failed"); }
    finally { setBusy(false); }
  }

  return (
    <section className="auth-card">
      <div className="auth-copy"><span className="eyebrow">LEARNER ACCOUNT</span><h1>Keep your learning fingerprint across sessions.</h1><p>Accounts persist XP, confidence scores and spaced-review items. Demo mode remains available for quick testing.</p></div>
      <form onSubmit={submit} className="auth-form">
        <div className="auth-tabs"><button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Sign in</button><button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Create account</button></div>
        {mode === "register" && <label>Display name<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required /></label>}
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required /></label>
        <button className="button primary wide" disabled={busy}>{busy ? "Working…" : mode === "login" ? "Sign in" : "Create account"}</button>
        <button type="button" className="text-button" onClick={() => { logout(); setMessage("Signed out. The app will use the demo learner until you sign in again."); }}>Use demo mode</button>
        <p className="auth-message">{message}</p>
      </form>
    </section>
  );
}
