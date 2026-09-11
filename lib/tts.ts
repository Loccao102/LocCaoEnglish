import { apiFetch } from "@/lib/api";

export type TTSResult = {
  provider: string;
  audioBase64: string | null;
  mimeType: string | null;
  text: string;
  locale: string;
  voice?: string;
  rate: number;
  disclaimer?: string;
};

export function synthesizeSpeech(text: string, rate = 1, voice = "en-US-JennyNeural") {
  return apiFetch<TTSResult>("/v1/ai/tts", {
    method: "POST",
    body: JSON.stringify({ text, locale: "en-US", voice, rate }),
  });
}

export async function playLearningAudio(text: string, rate = 1) {
  try {
    const result = await synthesizeSpeech(text, rate);
    if (result.audioBase64 && result.mimeType) {
      const audio = new Audio(`data:${result.mimeType};base64,${result.audioBase64}`);
      audio.playbackRate = 1;
      await audio.play();
      return result.provider;
    }
  } catch {}
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = Math.max(.6, Math.min(1.35, rate));
    window.speechSynthesis.speak(utterance);
    return "browser-speech-synthesis";
  }
  throw new Error("No audio engine is available in this browser.");
}
