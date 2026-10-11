"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch, type PronunciationScore, type SpeakingFeedback } from "@/lib/api";
import { AUTH_EVENT, getAuthToken } from "@/lib/session";

// Optional feedback is local to the captured sample. It never submits learning XP.
export default function useSpeakingFeedback(attemptId: string, text: string, target: string, audio: string) {
  const [coach, setCoach] = useState<SpeakingFeedback | null>(null);
  const [acoustic, setAcoustic] = useState<PronunciationScore | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false), [done, setDone] = useState(false);
  const sequence = useRef(0), controller = useRef<AbortController | null>(null), locked = useRef(false);
  useEffect(() => {
    const reset = () => {
      sequence.current++; controller.current?.abort(); locked.current = false;
      setCoach(null); setAcoustic(null); setErrors([]); setBusy(false); setDone(false);
    };
    const storage = (e: StorageEvent) => { if (e.key === "loccao_token" || e.key === null) reset(); };
    reset(); window.addEventListener(AUTH_EVENT, reset); window.addEventListener("storage", storage);
    return () => {
      sequence.current++; controller.current?.abort(); locked.current = false;
      window.removeEventListener(AUTH_EVENT, reset); window.removeEventListener("storage", storage);
    };
  }, [attemptId, text, target, audio]);

  async function analyze() {
    if (locked.current || done || !attemptId || (!text.trim() && !audio)) return;
    const seq = sequence.current, token = getAuthToken();
    const current = () => seq === sequence.current && token === getAuthToken();
    locked.current = true; setBusy(true); setErrors([]);
    const abort = new AbortController(); controller.current = abort;
    const init = { method: "POST", signal: abort.signal, headers: { Authorization: token ? `Bearer ${token}` : "" } };
    const outcomes = await Promise.allSettled([
      text.trim() && !coach ? apiFetch<SpeakingFeedback>("/v1/ai/speaking-feedback", { ...init, body: JSON.stringify({ transcript: text, target, topic: "guided practice" }) }) : Promise.resolve(coach),
      audio && !acoustic ? apiFetch<PronunciationScore>("/v1/ai/pronunciation-score", { ...init, body: JSON.stringify({ audioBase64: audio, referenceText: target, transcript: text, locale: "en-US" }) }) : Promise.resolve(acoustic),
    ]);
    if (!current()) return;
    const failures: string[] = [];
    const [language, pronunciation] = outcomes;
    if (language.status === "fulfilled") {
      if (language.value && (!Array.isArray(language.value.coaching) || language.value.coaching.some(x => typeof x !== "string") || typeof language.value.provider !== "string")) failures.push("Language feedback was invalid. Try again.");
      else setCoach(language.value);
    } else failures.push("Language coach is unavailable. Your transcript is kept; retry when ready.");
    if (pronunciation.status === "fulfilled") {
      const value = pronunciation.value;
      if (value && (typeof value.provider !== "string" || typeof value.acousticAssessment !== "boolean" ||
          value.acousticAssessment && (typeof value.overall !== "number" || !Number.isFinite(value.overall) || value.overall < 0 || value.overall > 100))) {
        failures.push("Pronunciation feedback was invalid. No acoustic score is available.");
      } else setAcoustic(value);
    } else failures.push("Pronunciation service is unavailable. No acoustic score was created.");
    setErrors(failures); setDone(failures.length === 0); setBusy(false); locked.current = false;
  }
  return { coach, acoustic, errors, busy, done, analyze };
}
