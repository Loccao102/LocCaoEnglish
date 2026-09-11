import DictationTrainer from "@/components/DictationTrainer";

export default function DictationPage() {
  return <div className="page-wrap narrow-page"><header className="content-header"><div><span className="eyebrow">LISTENING + SPELLING</span><h1>Dictation Rush</h1><p>Listen, type and compare. Missed vocabulary will later feed directly into the adaptive review queue.</p></div><span className="mode-badge">5 sentence ladder</span></header><DictationTrainer /></div>;
}
