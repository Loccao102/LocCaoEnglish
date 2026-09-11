import Link from "next/link";
import { games } from "@/data/learning";

const comingSoon = [
  ["Sentence Builder", "Rebuild a sentence from shuffled fragments.", "Grammar", "▦"],
  ["Grammar Repair", "Find the broken part before the timer ends.", "Grammar", "⌁"],
  ["Story Choice", "Choose responses and change an interactive story.", "Reading", "◫"],
  ["Collocation Factory", "Build natural English combinations under pressure.", "Vocabulary", "⚙"],
  ["Reading Race", "Skim, scan and answer before time runs out.", "Reading", "↯"],
  ["Boss Fight", "Mix multiple skills in one real-life mission.", "Mixed", "♜"],
];

export default function GamesPage() {
  return (
    <div className="page-wrap">
      <header className="content-header">
        <div><span className="eyebrow">GAME LIBRARY</span><h1>Practice without feeling like a test.</h1><p>Every mini-game emits learning events. Those attempts will eventually update your skill fingerprint and decide what the system recommends next.</p></div>
        <span className="mode-badge">MVP · 4 playable</span>
      </header>

      <section className="game-grid">
        {games.map((game) => {
          const href = game.slug === "word-link" ? "/games/word-link" : `/${game.slug}`;
          return <Link className="game-card playable" href={href} key={game.slug}><span className="game-icon">{game.icon}</span><span className="game-skill">{game.skill}</span><h2>{game.name}</h2><p>{game.description}</p><div><small>◷ {game.minutes} min</small><b>Play →</b></div></Link>;
        })}
        {comingSoon.map(([name, description, skill, icon]) => <article className="game-card disabled" key={name}><span className="game-icon">{icon}</span><span className="game-skill">{skill}</span><h2>{name}</h2><p>{description}</p><div><small>Coming next</small><b>Locked</b></div></article>)}
      </section>
    </div>
  );
}
