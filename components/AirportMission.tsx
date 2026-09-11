"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { recordAttempt, sendConversation } from "@/lib/api";

type Message = { role: "agent" | "user"; content: string };

const stages = [
  { title: "Check-in vocabulary", skill: "Vocabulary", href: "/games/word-link", icon: "01" },
  { title: "Flight announcement", skill: "Listening", href: "/dictation", icon: "02" },
  { title: "Explain the problem", skill: "Speaking", href: "/speaking", icon: "03" },
];

export default function AirportMission() {
  const [done, setDone] = useState<boolean[]>([false, false, false]);
  const [messages, setMessages] = useState<Message[]>([{ role: "agent", content: "Good afternoon. How can I help you with your flight today?" }]);
  const [objective, setObjective] = useState("Explain that you missed your flight and ask to be rebooked.");
  const [text, setText] = useState("");
  const [turns, setTurns] = useState(0);
  const [busy, setBusy] = useState(false);
  const unlocked = done.every(Boolean);
  const won = turns >= 3;
  const progress = useMemo(() => (done.filter(Boolean).length + (won ? 1 : 0)) / 4 * 100, [done, won]);

  async function chat(e: FormEvent) {
    e.preventDefault(); if (!text.trim() || busy) return;
    const userText = text.trim(); setText(""); setBusy(true);
    const nextMessages = [...messages, { role: "user" as const, content: userText }]; setMessages(nextMessages);
    try {
      const result = await sendConversation(userText, nextMessages.map((m) => ({ role: m.role === "agent" ? "assistant" : "user", content: m.content })));
      setMessages([...nextMessages, { role: "agent", content: result.reply }]); setObjective(result.objective); setTurns((v) => v + 1);
      await recordAttempt({ skill: "Speaking", activity: "npc-conversation", itemKey: `airport-npc-${turns + 1}`, prompt: objective, answer: userText, accuracy: 0.9 });
    } catch { setMessages([...nextMessages, { role: "agent", content: "The live coach is offline, but your response was saved locally in this mission. Try again after starting the API + AI services." }]); }
    finally { setBusy(false); }
  }

  return (
    <div className="mission-shell">
      <section className="mission-header"><div><span className="eyebrow light">TRAVEL BOSS · AIRPORT</span><h1>You missed your flight.</h1><p>Complete the language checkpoints, then negotiate a new flight with the airline agent.</p></div><div className="mission-progress"><strong>{Math.round(progress)}%</strong><small>mission</small></div></section>
      <div className="mission-stage-grid">{stages.map((stage, i) => <article className={`mission-stage ${done[i] ? "complete" : ""}`} key={stage.title}><span>{stage.icon}</span><div><small>{stage.skill}</small><strong>{stage.title}</strong></div><div className="mission-stage-actions"><Link href={stage.href}>Practice ↗</Link><button onClick={() => setDone((v) => v.map((x, idx) => idx === i ? true : x))}>{done[i] ? "✓ Ready" : "Mark ready"}</button></div></article>)}</div>
      <section className={`npc-panel ${!unlocked ? "locked" : ""}`}><div className="npc-panel-head"><div><span className="npc-avatar">AI</span><div><small>FINAL CHECKPOINT</small><strong>Airline service desk</strong></div></div><span className="mode-badge">{won ? "MISSION COMPLETE" : unlocked ? "NPC UNLOCKED" : "LOCKED"}</span></div>
        {!unlocked ? <div className="npc-lock"><strong>Finish the first three checkpoints.</strong><p>The final conversation unlocks when Vocabulary, Listening and Speaking are marked ready.</p></div> : <><div className="objective-box"><small>CURRENT OBJECTIVE</small><strong>{won ? "Success — you handled the rebooking conversation." : objective}</strong></div><div className="chat-log">{messages.map((m, i) => <div className={`chat-bubble ${m.role}`} key={i}><span>{m.role === "agent" ? "Agent" : "You"}</span><p>{m.content}</p></div>)}</div>{!won ? <form className="chat-form" onSubmit={chat}><input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type what you would say in English…" /><button className="button primary" disabled={busy}>{busy ? "Thinking…" : "Send →"}</button></form> : <div className="boss-win"><span>✦</span><div><strong>Boss cleared +150 XP</strong><p>You used vocabulary, listening, speaking and conversation in one real-world mission.</p></div></div>}</>}
      </section>
    </div>
  );
}
