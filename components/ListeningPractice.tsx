"use client";

import { useState } from "react";
import { recordAttempt } from "@/lib/api";
import { playLearningAudio } from "@/lib/tts";

const rounds = [
  { audio: "Attention passengers. Flight VN218 to Da Nang will now depart from gate twelve instead of gate eight.", q: "What changed?", answer: "The departure gate", options: ["The destination", "The departure gate", "The flight number", "The airline"] },
  { audio: "The museum closes at six, but the last guided tour begins at four thirty in the afternoon.", q: "When does the last guided tour begin?", answer: "4:30 p.m.", options: ["4:00 p.m.", "4:30 p.m.", "5:30 p.m.", "6:00 p.m."] },
  { audio: "Due to engineering work, trains to Oxford will leave from platform six until noon, then return to platform three.", q: "Where do Oxford trains leave from before noon?", answer: "Platform six", options: ["Platform three", "Platform four", "Platform six", "Platform nine"] },
];

export default function ListeningPractice() {
  const [index, setIndex] = useState(0); const [chosen, setChosen] = useState(""); const [audioProvider, setAudioProvider] = useState(""); const [playing, setPlaying] = useState(false);
  const current = rounds[index];
  async function play(rate = .95) { setPlaying(true); try { setAudioProvider(await playLearningAudio(current.audio, rate)); } catch { setAudioProvider("audio unavailable"); } finally { setPlaying(false); } }
  function pick(value: string) { if (chosen) return; setChosen(value); recordAttempt({ skill: "Listening", activity: "listen-pick", itemKey: `listen:${index}`, prompt: current.audio, answer: current.answer, accuracy: value === current.answer ? 1 : 0 }).catch(() => {}); }
  function next() { setIndex((value) => (value + 1) % rounds.length); setChosen(""); setAudioProvider(""); }
  return <section className="mini-card listening-game"><div className="mini-head"><span className="eyebrow">LISTEN & PICK · SERVER AUDIO</span><b>{index + 1}/{rounds.length}</b></div><div className="audio-actions"><button className="listen-orb" disabled={playing} onClick={() => void play(.95)}>▶<small>{playing ? "loading audio…" : "play announcement"}</small></button><button className="speed-button" disabled={playing} onClick={() => void play(.72)}>0.72×</button></div>{audioProvider && <p className="audio-provider">Audio: {audioProvider}</p>}<h2>{current.q}</h2><div className="choice-stack">{current.options.map((value) => <button key={value} className={chosen ? value === current.answer ? "correct" : value === chosen ? "wrong" : "muted" : ""} onClick={() => pick(value)}>{value}</button>)}</div>{chosen && <><p className="mini-feedback">{chosen === current.answer ? "Correct — you caught the key detail." : `Target answer: ${current.answer}`}</p><button className="button primary wide" onClick={next}>Next audio →</button></>}</section>;
}
