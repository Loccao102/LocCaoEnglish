"use client";

import { useMemo, useRef, useState } from "react";

const prompts = [
  "Could I have a window seat, please?",
  "I usually prefer travelling by train because it is more comfortable.",
  "One of the main reasons people move to large cities is the availability of better job opportunities.",
];

function similarity(target: string, transcript: string) {
  const clean = (value: string) => value.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(Boolean);
  const expected = clean(target);
  const spoken = new Set(clean(transcript));
  return Math.round((expected.filter((word) => spoken.has(word)).length / expected.length) * 100);
}

export default function SpeakingPractice() {
  const [index, setIndex] = useState(0);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<any>(null);
  const prompt = prompts[index];
  const score = useMemo(() => transcript ? similarity(prompt, transcript) : 0, [prompt, transcript]);

  function playPrompt() {
    if (!("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(prompt);
    utterance.lang = "en-US"; utterance.rate = 0.9;
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(utterance);
  }

  function start() {
    const BrowserRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!BrowserRecognition) { setSupported(false); return; }
    const recognition = new BrowserRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (event: any) => {
      let value = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) value += event.results[i][0].transcript;
      setTranscript(value.trim());
    };
    recognitionRef.current = recognition;
    recognition.start();
  }

  function next() { setIndex((value) => (value + 1) % prompts.length); setTranscript(""); }

  return (
    <section className="speaking-card">
      <div className="scene-tag">AIRPORT · SHADOWING</div>
      <div className="speaker-bubble"><span className="npc-avatar">AI</span><div><small>Listen and repeat naturally</small><strong>{prompt}</strong></div><button onClick={playPrompt}>🔊</button></div>
      <div className={`mic-stage ${listening ? "live" : ""}`}><button className="mic-button" onClick={start}>{listening ? "■" : "●"}</button><strong>{listening ? "Listening…" : "Tap to speak"}</strong><small>Browser speech recognition · no audio is uploaded in this MVP</small></div>
      {!supported && <div className="notice error">Speech recognition is not available in this browser. Try a Chromium-based browser or connect the future STT service.</div>}
      {transcript && <div className="speech-result"><div><span>TRANSCRIPT</span><p>“{transcript}”</p></div><div className="speech-score"><strong>{score}</strong><small>match</small></div></div>}
      {transcript && <div className="practice-actions"><button className="button ghost" onClick={start}>Try again</button><button className="button primary" onClick={next}>Next prompt →</button></div>}
    </section>
  );
}
