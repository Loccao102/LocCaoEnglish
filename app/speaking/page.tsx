import SpeakingPractice from "@/components/SpeakingPractice";

export default async function SpeakingPage({ searchParams }: { searchParams: Promise<{ pack?: string }> }) {
  const { pack } = await searchParams;
  return <div className="page-wrap narrow-page">
    <header className="content-header"><div><span className="eyebrow">SPEAKING LAB</span><h1>Shadow Me</h1>
      <p>Practise phrases, compare your transcript, and ask for pronunciation feedback.</p></div>
      <span className="mode-badge">Guided practice</span></header>
    <SpeakingPractice pack={pack} />
  </div>;
}
