import VerifiedSentenceBuilder from "@/components/learning/VerifiedSentenceBuilder";

export default async function Page({ searchParams }: { searchParams: Promise<{ pack?: string }> }) {
  const { pack } = await searchParams;
  return <div className="page-wrap narrow-page">
    <header className="simple-header"><span className="eyebrow">GRAMMAR GAME</span><h1>Sentence Builder</h1><p>Arrange the pieces to express an idea. Build three sentences and discover how each pattern works.</p></header>
    <VerifiedSentenceBuilder pack={pack} />
  </div>;
}
