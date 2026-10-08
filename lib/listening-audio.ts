import type { ListeningAudio } from "./learning-attempt";

// Resolve on completion, not when play()/speak() merely queues the audio.
export function playListeningClip(clip: ListeningAudio, signal: AbortSignal): Promise<void> {
 return new Promise((resolve,reject) => {
  let settled=false, started=false, media:HTMLAudioElement|undefined, utterance:SpeechSynthesisUtterance|undefined;
  const finish=(error?:Error) => {
   if(settled)return; settled=true; clearTimeout(timeout); signal.removeEventListener("abort",cancel);
   if(media){media.onended=null;media.onerror=null;media.onplaying=null;media.pause();media.removeAttribute("src");}
   if(utterance){utterance.onend=null;utterance.onerror=null;utterance.onstart=null;if(error)window.speechSynthesis.cancel();}
   if(error)reject(error);else resolve();
  };
  const cancel=()=>finish(new Error("Audio stopped before finishing. Play it again when ready."));
  const timeout=setTimeout(()=>finish(new Error("Audio did not finish. Check your sound settings and try again.")),90000);
  signal.addEventListener("abort",cancel,{once:true}); if(signal.aborted){cancel();return;}
  try {
   if(clip.provider==="azure-speech-neural-tts" && clip.audioBase64 && clip.mimeType==="audio/mpeg") {
    media=new Audio(`data:${clip.mimeType};base64,${clip.audioBase64}`);
    media.onplaying=()=>{started=true;};
    media.onended=()=>finish(started?undefined:new Error("Audio never started."));
    media.onerror=()=>finish(new Error("This audio could not be played. Please try again."));
    void media.play().catch(()=>finish(new Error("Playback was blocked. Please try again.")));
   } else if(clip.provider==="browser-speech-synthesis" && clip.text && "speechSynthesis" in window) {
    utterance=new SpeechSynthesisUtterance(clip.text); utterance.lang="en-US";utterance.rate=clip.rate;
    utterance.onstart=()=>{started=true;};
    utterance.onend=()=>finish(started?undefined:new Error("Speech never started."));
    utterance.onerror=()=>finish(new Error("Your browser could not read this clip. Check its English voice settings and try again."));
    window.speechSynthesis.speak(utterance);
   } else finish(new Error("No audio engine is available. Use a browser with an English speech voice."));
  } catch { finish(new Error("Audio is unavailable. Please try again.")); }
 });
}
