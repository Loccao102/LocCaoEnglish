"use client";

import { useEffect, useRef, useState } from "react";
import { wavBase64 } from "@/lib/speaking-audio";
import { AUTH_EVENT, getAuthToken } from "@/lib/session";

type Recognition = {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null; onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
};
type Handle = { context: AudioContext; stream: MediaStream; source: MediaStreamAudioSourceNode;
  processor: ScriptProcessorNode; gain: GainNode; chunks: Float32Array[]; sampleRate: number };

export default function useSpeakingRecorder(attemptId: string, onTranscript: (text: string) => void) {
  const [phase, setPhase] = useState<"idle" | "requesting" | "recording">("idle");
  const [audio, setAudio] = useState("");
  const [sampleId, setSampleId] = useState("");
  const [message, setMessage] = useState("");
  const recorder = useRef<Handle | null>(null), recognition = useRef<Recognition | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0), locked = useRef(false), transcript = useRef(onTranscript);
  transcript.current = onTranscript;

  function release() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const speech = recognition.current; recognition.current = null;
    if (speech) {
      speech.onresult = null; speech.onerror = null; speech.onend = null;
      try { speech.abort(); } catch { /* Already stopped. */ }
    }
    const handle = recorder.current; recorder.current = null;
    if (handle) {
      handle.processor.onaudioprocess = null;
      handle.stream.getTracks().forEach(track => track.stop());
      handle.source.disconnect(); handle.processor.disconnect(); handle.gain.disconnect();
      void handle.context.close().catch(() => {});
    }
    return handle;
  }
  function cancel() {
    generation.current++; locked.current = false; release();
    setPhase("idle"); setAudio(""); setSampleId(""); setMessage("");
    window.speechSynthesis?.cancel();
  }
  useEffect(() => {
    cancel();
    const storage = (e: StorageEvent) => { if (e.key === "loccao_token" || e.key === null) cancel(); };
    const hidden = () => { if (document.hidden) stop(); };
    window.addEventListener(AUTH_EVENT, cancel); window.addEventListener("storage", storage);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      generation.current++; locked.current = false; release(); window.speechSynthesis?.cancel();
      window.removeEventListener(AUTH_EVENT, cancel); window.removeEventListener("storage", storage);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [attemptId]);

  function stop() {
    generation.current++; locked.current = false;
    const handle = release(); setPhase("idle");
    if (!handle) return;
    if (!handle.chunks.length) { setMessage("No audio was captured. Try recording again."); return; }
    setAudio(wavBase64(handle.chunks, handle.sampleRate));
    setSampleId(crypto.randomUUID());
  }
  async function start() {
    if (locked.current || !attemptId) return;
    locked.current = true;
    const seq = ++generation.current, token = getAuthToken();
    const current = () => seq === generation.current && token === getAuthToken();
    setPhase("requesting"); setMessage(""); setAudio(""); setSampleId("");
    window.speechSynthesis?.cancel();
    let stream: MediaStream | undefined, context: AudioContext | undefined;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone recording is unavailable in this browser.");
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      if (!current()) { stream.getTracks().forEach(track => track.stop()); return; }
      context = new AudioContext();
      const source = context.createMediaStreamSource(stream), processor = context.createScriptProcessor(4096, 1, 1), gain = context.createGain();
      const chunks: Float32Array[] = []; gain.gain.value = 0;
      processor.onaudioprocess = event => { if (current()) chunks.push(new Float32Array(event.inputBuffer.getChannelData(0))); };
      source.connect(processor); processor.connect(gain); gain.connect(context.destination);
      recorder.current = { context, stream, source, processor, gain, chunks, sampleRate: context.sampleRate };
      transcript.current(""); setPhase("recording");
      const browser = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
      const Constructor = browser.SpeechRecognition || browser.webkitSpeechRecognition;
      if (Constructor) {
        const speech = new Constructor(); recognition.current = speech;
        speech.lang = "en-US"; speech.interimResults = true; speech.continuous = true;
        speech.onresult = event => {
          if (current()) transcript.current(Array.from(event.results).map(result => result[0].transcript).join(" ").trim().slice(0, 2048));
        };
        speech.onerror = () => { if (current()) setMessage("Live transcript is unavailable. You can review or type what you said below."); };
        speech.onend = () => { if (current()) stop(); };
        try { speech.start(); } catch { setMessage("Live transcript is unavailable. You can type what you said below."); }
      } else setMessage("Live transcript is unavailable. You can type what you said below.");
      timer.current = setTimeout(() => { if (current()) stop(); }, 10000);
    } catch (error) {
      stream?.getTracks().forEach(track => track.stop());
      if (context && context.state !== "closed") void context.close().catch(() => {});
      if (!current()) return;
      release(); locked.current = false; setPhase("idle");
      setMessage(error instanceof Error ? error.message : "Could not start recording. Check microphone permission and try again.");
    }
  }
  return { phase, audio, sampleId, message, start, stop, cancel };
}
