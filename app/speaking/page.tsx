import SpeakingPractice from "@/components/SpeakingPractice";

export default function SpeakingPage() {
  return <div className="page-wrap narrow-page"><header className="content-header"><div><span className="eyebrow">SPEAKING LAB</span><h1>Shadow Me</h1><p>Hear a phrase, repeat it and inspect the recognized transcript. The production version will score pronunciation, fluency, grammar and vocabulary separately.</p></div><span className="mode-badge">Browser STT prototype</span></header><SpeakingPractice /></div>;
}
