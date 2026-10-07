import VerifiedWordGraph from "@/components/learning/VerifiedWordGraph";

export default function Page() {
  return <div className="page-wrap narrow-page">
    <header className="simple-header"><span className="eyebrow">WORD GRAPH · PRACTICE</span><h1>Connect the idea</h1><p>Use the situation to choose a connection. Three rounds, with an explanation after each choice.</p></header>
    <VerifiedWordGraph />
  </div>;
}
