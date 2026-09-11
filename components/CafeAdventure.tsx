"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  apiFetch,
  BossState,
  ConversationReply,
  getProgression,
  recordAttempt,
} from "@/lib/api";
import { BossEvaluation, claimBoss, evaluateBoss } from "@/lib/missions";

type Message = { role: "agent" | "user"; content: string };
type BreakfastChoice = { text: string; quality: number; feedback: string };
type BreakfastBeat = {
  maya: string;
  goal: string;
  choices: BreakfastChoice[];
};

const beats: BreakfastBeat[] = [
  {
    maya: "Good morning! What can I get for you?",
    goal: "Order a drink politely.",
    choices: [
      { text: "Can I have a latte, please?", quality: 1, feedback: "Natural and polite." },
      { text: "I want a latte.", quality: .68, feedback: "Clear, but a little direct." },
      { text: "Give me latte.", quality: .35, feedback: "Understandable, but not natural for ordering." },
    ],
  },
  {
    maya: "Of course. Would you like anything to eat with that?",
    goal: "Add food to your order.",
    choices: [
      { text: "Yes, I’d like a croissant too, please.", quality: 1, feedback: "Great ordering phrase." },
      { text: "Croissant too.", quality: .6, feedback: "It works, but a full sentence sounds more natural." },
      { text: "I take croissant.", quality: .4, feedback: "Try “I’d like…” when ordering." },
    ],
  },
  {
    maya: "Perfect. Is that for here or to go?",
    goal: "Tell Maya where you want to have your order.",
    choices: [
      { text: "For here, please.", quality: 1, feedback: "Exactly right." },
      { text: "I eat here.", quality: .62, feedback: "Clear, but “For here” is the usual café phrase." },
      { text: "Here.", quality: .48, feedback: "Understandable, but too short for a natural exchange." },
    ],
  },
];

const regularIntro = "Hey, is this seat free? I don't think we've met before.";
const regularObjective = "Introduce yourself and keep the conversation moving with a genuine question.";

export default function CafeAdventure() {
  const [boss, setBoss] = useState<BossState | null>(null);
  const [notice, setNotice] = useState("");
  const [breakfastStep, setBreakfastStep] = useState(0);
  const [breakfastScore, setBreakfastScore] = useState<number[]>([]);
  const [breakfastFeedback, setBreakfastFeedback] = useState("");
  const [breakfastDone, setBreakfastDone] = useState(false);
  const [mode, setMode] = useState<"order" | "social">("order");
  const [messages, setMessages] = useState<Message[]>([{ role: "agent", content: regularIntro }]);
  const [objective, setObjective] = useState(regularObjective);
  const [verdict, setVerdict] = useState<BossEvaluation | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("loccao_cafe_breakfast");
      if (saved === "done") {
        setBreakfastDone(true);
        setMode("social");
      }
    } catch {}
    getProgression()
      .then((state) => setBoss(state.bosses.find((item) => item.id === "cafe-connection") ?? null))
      .catch((error) => setNotice(error instanceof Error ? error.message : "Progression service is offline."));
  }, []);

  const checkpoints = boss?.checkpoints ?? [];
  const unlocked = Boolean(boss?.unlocked);
  const won = Boolean(boss?.cleared);
  const averageBreakfast = breakfastScore.length
    ? breakfastScore.reduce((sum, value) => sum + value, 0) / breakfastScore.length
    : 0;
  const conversationStage = won ? 3 : verdict?.stage ?? 0;
  const totalProgress = Math.round(((breakfastDone ? 1 : 0) + conversationStage / 3) / 2 * 100);

  const questLabel = useMemo(() => {
    if (!breakfastDone) return `Order breakfast · ${Math.min(breakfastStep + 1, 3)}/3`;
    if (won) return "Café Connection complete";
    if (!unlocked) return "Build conversation checkpoints";
    return `Talk to Leo · ${conversationStage}/3 objectives`;
  }, [breakfastDone, breakfastStep, conversationStage, unlocked, won]);

  async function chooseBreakfast(choice: BreakfastChoice) {
    if (breakfastDone || busy) return;
    setBreakfastFeedback(choice.feedback);
    const scores = [...breakfastScore, choice.quality];
    setBreakfastScore(scores);
    setBusy(true);
    try {
      await recordAttempt({
        skill: "Speaking",
        activity: "cafe-ordering",
        itemKey: `cafe-breakfast-${breakfastStep + 1}`,
        prompt: beats[breakfastStep].goal,
        answer: choice.text,
        accuracy: choice.quality,
      });
    } catch {
      // The playable scene still works in local/offline mode.
    } finally {
      setBusy(false);
    }

    if (breakfastStep < beats.length - 1) {
      window.setTimeout(() => {
        setBreakfastStep((step) => step + 1);
        setBreakfastFeedback("");
      }, 650);
      return;
    }

    try { localStorage.setItem("loccao_cafe_breakfast", "done"); } catch {}
    setBreakfastDone(true);
    window.setTimeout(() => setMode("social"), 800);
  }

  async function chat(event: FormEvent) {
    event.preventDefault();
    if (!text.trim() || busy || !unlocked || won) return;
    const userText = text.trim();
    setText("");
    setBusy(true);
    const next = [...messages, { role: "user" as const, content: userText }];
    setMessages(next);
    try {
      const reply = await apiFetch<ConversationReply>("/v1/conversation/reply", {
        method: "POST",
        body: JSON.stringify({
          message: userText,
          scenario: "cafe",
          level: "B1",
          history: next.map((message) => ({
            role: message.role === "agent" ? "assistant" : "user",
            content: message.content,
          })),
        }),
      });
      setMessages([...next, { role: "agent", content: reply.reply }]);
      setObjective(reply.objective);
      const userLines = next.filter((message) => message.role === "user").map((message) => message.content);
      await recordAttempt({
        skill: "Speaking",
        activity: "npc-conversation-cafe",
        itemKey: `cafe-npc-${userLines.length}`,
        prompt: objective,
        answer: userText,
        accuracy: .85,
      });
      const evaluation = await evaluateBoss("cafe-connection", userLines);
      setVerdict(evaluation);
      if (evaluation.complete) {
        setClaiming(true);
        const state = await claimBoss("cafe-connection", userLines);
        const updated = state.bosses.find((item) => item.id === "cafe-connection") ?? null;
        setBoss(updated);
        setNotice(`Café Connection cleared. +${updated?.rewardXp ?? boss?.rewardXp ?? 0} XP and Social Spark unlocked.`);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Café conversation is unavailable right now.");
    } finally {
      setBusy(false);
      setClaiming(false);
    }
  }

  const beat = beats[Math.min(breakfastStep, beats.length - 1)];

  return (
    <div className="cafe-game-shell">
      <header className="cafe-top-hud">
        <Link href="/worlds" className="cafe-back">← Town</Link>
        <div className="cafe-quest-chip">
          <small>ACTIVE QUEST</small>
          <strong>Breakfast Run</strong>
          <span>{questLabel}</span>
        </div>
        <div className="cafe-progress-chip">
          <strong>{totalProgress}%</strong>
          <div className="cafe-progress"><i style={{ width: `${totalProgress}%` }} /></div>
        </div>
      </header>

      {notice && <div className="cafe-notice">{notice}</div>}

      <main className="cafe-stage">
        <div className="cafe-window"><span className="cafe-sun"/><i/><i/><i/></div>
        <div className="cafe-wall-sign">MAYA’S<br/><b>CAFÉ</b></div>
        <div className="cafe-menu-board"><strong>MENU</strong><span>Latte · 4.0</span><span>Americano · 3.2</span><span>Croissant · 2.5</span></div>
        <div className="cafe-shelf"><i/><i/><i/></div>
        <div className="cafe-floor floor-a"/><div className="cafe-floor floor-b"/><div className="cafe-floor floor-c"/>
        <div className="cafe-counter"><span/><i/><b/></div>
        <div className="espresso-machine"><span/><i/><b/></div>
        <div className="pastry-case"><i/><i/><i/></div>
        <div className="cafe-table table-one"><i/><b/><em/></div>
        <div className="cafe-table table-two"><i/><b/><em/></div>
        <div className="plant-pot"><i/><b/><em/></div>

        <div className={`cafe-npc maya ${mode === "order" ? "active" : ""}`}>
          <span className="npc-shadow"/>
          <span className="npc-head"><i/></span>
          <span className="npc-hair"/>
          <span className="npc-body"/>
          <span className="npc-apron"/>
          <span className="npc-arm left"/><span className="npc-arm right"/>
          <span className="npc-leg left"/><span className="npc-leg right"/>
          <b className="npc-name">Maya · Barista</b>
        </div>

        <div className={`cafe-npc leo ${mode === "social" ? "active" : ""}`}>
          <span className="npc-shadow"/>
          <span className="npc-head"><i/></span>
          <span className="npc-hair"/>
          <span className="npc-body"/>
          <span className="npc-arm left"/><span className="npc-arm right"/>
          <span className="npc-leg left"/><span className="npc-leg right"/>
          <b className="npc-name">Leo · Café regular</b>
        </div>

        <div className="cafe-player-character">
          <span className="npc-shadow"/>
          <span className="npc-head"><i/></span>
          <span className="npc-hair"/>
          <span className="npc-body"/>
          <span className="npc-arm left"/><span className="npc-arm right"/>
          <span className="npc-leg left"/><span className="npc-leg right"/>
        </div>

        {mode === "order" ? (
          <section className="cafe-dialogue-panel order-panel">
            <div className="dialogue-speaker"><span>☕</span><div><small>MAYA · BARISTA</small><strong>{beat.maya}</strong></div></div>
            <div className="dialogue-goal"><small>YOUR GOAL</small><b>{beat.goal}</b></div>
            <div className="cafe-choice-grid">
              {beat.choices.map((choice) => (
                <button key={choice.text} disabled={busy || Boolean(breakfastFeedback)} onClick={() => void chooseBreakfast(choice)}>
                  {choice.text}
                </button>
              ))}
            </div>
            {breakfastFeedback && <div className="cafe-feedback"><strong>{breakfastFeedback}</strong><span>Naturalness score: {Math.round((breakfastScore.at(-1) ?? 0) * 100)}%</span></div>}
          </section>
        ) : (
          <section className="cafe-dialogue-panel social-panel">
            <div className="dialogue-speaker"><span>🙂</span><div><small>LEO · CAFÉ REGULAR</small><strong>{won ? "Nice talking to you — see you around!" : messages.at(-1)?.content ?? regularIntro}</strong></div></div>
            {!unlocked && !won ? (
              <div className="cafe-gate">
                <strong>This conversation chapter is still locked.</strong>
                <p>Breakfast practice is complete. Earn the required speaking checkpoints, then return to Leo.</p>
                <div className="cafe-checkpoints">
                  {checkpoints.map((checkpoint) => <Link key={checkpoint.id} href={checkpoint.route} className={checkpoint.complete ? "done" : ""}>{checkpoint.complete ? "✓" : "○"} {checkpoint.skill} · {checkpoint.title}</Link>)}
                </div>
              </div>
            ) : won ? (
              <div className="cafe-win">
                <span>✦</span><div><strong>Café Connection cleared</strong><p>Social Spark is unlocked and the town has new conversation progress.</p></div><Link href="/worlds">Return to town →</Link>
              </div>
            ) : (
              <>
                <div className="dialogue-goal"><small>CURRENT OBJECTIVE</small><b>{objective}</b>{verdict && <span>{verdict.missing.length ? `Still needed: ${verdict.missing.join(" · ")}` : "All objectives satisfied."}</span>}</div>
                <div className="cafe-conversation-history">
                  {messages.slice(-4).map((message, index) => <div key={`${index}-${message.content}`} className={message.role}><span>{message.role === "agent" ? "Leo" : "You"}</span><p>{message.content}</p></div>)}
                </div>
                <form className="cafe-chat-form" onSubmit={chat}>
                  <input value={text} onChange={(event) => setText(event.target.value)} placeholder="Type what you would say in English…" autoComplete="off" />
                  <button disabled={busy || claiming}>{claiming ? "Completing…" : busy ? "Thinking…" : "Say it →"}</button>
                </form>
              </>
            )}
          </section>
        )}

        <aside className="cafe-mini-objectives">
          <small>QUEST STEPS</small>
          <span className={breakfastDone ? "done" : "active"}>{breakfastDone ? "✓" : "1"} Order breakfast</span>
          <span className={won ? "done" : breakfastDone ? "active" : ""}>{won ? "✓" : "2"} Meet someone new</span>
          <span className={won ? "done" : ""}>{won ? "✓" : "3"} Keep the exchange alive</span>
          {breakfastDone && <b>Order score · {Math.round(averageBreakfast * 100)}%</b>}
        </aside>
      </main>
    </div>
  );
}
