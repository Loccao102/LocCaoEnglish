import Link from "next/link";
import { games } from "@/data/learning";

const future=[
  ["Pronunciation Battle","Acoustic pronunciation scoring when an audio provider is configured.","Speaking","◉"],
  ["Paragraph Puzzle","Reorder evidence and claims into a coherent IELTS paragraph.","Writing","▤"],
  ["Synonym Escape","Move through a maze by choosing meaning-preserving paraphrases.","Vocabulary","↗"],
  ["Detect the Lie","Find the statement not supported by a passage.","Reading","?"],
];
export default function GamesPage(){return <div className="page-wrap"><header className="content-header"><div><span className="eyebrow">GAME LIBRARY</span><h1>Practice without feeling like a test.</h1><p>Every playable activity emits learning events so the system can discover weak skills and schedule what comes back next.</p></div><span className="mode-badge">12 PLAYABLE EXPERIENCES</span></header><section className="game-grid">{games.map((game)=><Link className="game-card playable" href={game.href} key={game.slug}><span className="game-icon">{game.icon}</span><span className="game-skill">{game.skill}</span><h2>{game.name}</h2><p>{game.description}</p><div><small>◷ {game.minutes} min</small><b>Play →</b></div></Link>)}{future.map(([name,description,skill,icon])=><article className="game-card disabled" key={name}><span className="game-icon">{icon}</span><span className="game-skill">{skill}</span><h2>{name}</h2><p>{description}</p><div><small>Expansion</small><b>Planned</b></div></article>)}</section></div>}
