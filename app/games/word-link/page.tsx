import WordLinkGame from "@/components/WordLinkGame";

export default function WordLinkPage() {
  return <div className="page-wrap"><header className="content-header"><div><span className="eyebrow">VOCABULARY GAME · A1 → C2</span><h1>Word Link</h1><p>Build vocabulary as a network instead of a flat list. Every round is issued and graded by the server, so feedback, review evidence and XP come from the answer you actually chose.</p></div><span className="mode-badge">Verified attempt · +20 XP / correct</span></header><WordLinkGame /></div>;
}
