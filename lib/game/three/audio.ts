/** Small original synthesized effects. Audio is unlocked only by a player gesture. */
export class VillageAudio {
  private context: AudioContext | null = null;
  enabled = true;
  unlock() {
    if (!this.enabled) return;
    try { this.context ||= new AudioContext(); if (this.context.state === "suspended") void this.context.resume().catch(() => {}); } catch { /* The game remains playable without audio. */ }
  }
  private tone(frequency: number, length: number, volume: number, delay=0, type: OscillatorType="sine") {
    const ctx=this.context;if(!this.enabled||!ctx||ctx.state!=="running")return;
    const oscillator=ctx.createOscillator(),gain=ctx.createGain(),start=ctx.currentTime+delay;
    oscillator.type=type;oscillator.frequency.setValueAtTime(frequency,start);oscillator.frequency.exponentialRampToValueAtTime(frequency*.65,start+length);
    gain.gain.setValueAtTime(.001,start);gain.gain.exponentialRampToValueAtTime(volume,start+.008);gain.gain.exponentialRampToValueAtTime(.001,start+length);
    oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start(start);oscillator.stop(start+length+.02);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
  }
  step() { this.tone(145,.06,.025,0,"triangle"); }
  pickup() { this.tone(660,.18,.065);this.tone(880,.25,.05,.10);this.tone(1320,.35,.035,.2); }
  open() { this.tone(330,.20,.05);this.tone(495,.30,.035,.12); }
  jump() { this.tone(270,.15,.035); }
  dispose() { if(this.context)void this.context.close().catch(() => {});this.context=null; }
}
