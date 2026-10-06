import VerifiedCollocationFactory from "@/components/learning/VerifiedCollocationFactory";

export default async function Page({ searchParams }: { searchParams: Promise<{ pack?: string }> }) {
  const { pack } = await searchParams;
  return <div className="page-wrap narrow-page"><header className="simple-header"><span className="eyebrow">VOCABULARY GAME</span><h1>Collocation Factory</h1><p>Read the situation and build the word pair that fits. Complete three rounds, learn from each explanation, and try a new set at your own pace.</p></header><VerifiedCollocationFactory pack={pack} /></div>;
}
