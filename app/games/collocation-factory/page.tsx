import VerifiedCollocationFactory from "@/components/learning/VerifiedCollocationFactory";

export default async function Page({ searchParams }: { searchParams: Promise<{ pack?: string }> }) {
  const { pack } = await searchParams;
  return <div className="page-wrap narrow-page"><header className="simple-header"><span className="eyebrow">VOCABULARY GAME · SERVER VERIFIED</span><h1>Collocation Factory</h1><p>Build natural word pairs. Your actual choice is checked once by the shared learning round engine.</p></header><VerifiedCollocationFactory pack={pack} /></div>;
}
