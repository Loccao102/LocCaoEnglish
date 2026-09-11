import WordLinkGame from "@/components/WordLinkGame";

export default function WordLinkPage() {
  return <div className="page-wrap"><header className="content-header"><div><span className="eyebrow">VOCABULARY GAME</span><h1>Word Link</h1><p>Build vocabulary as a network rather than a flat word list: meaning, synonym, antonym, word family and collocation.</p></div><span className="mode-badge">+20 XP / correct link</span></header><WordLinkGame /></div>;
}
