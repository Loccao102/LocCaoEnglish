import Link from "next/link";
import { festivalGames } from "@/lib/game/festival";
import { companionById } from "@/lib/game/companions";
import { games } from "@/data/learning";
import { companionForPath } from "@/lib/game/companions";
import CompanionPortrait from "@/components/game/CompanionPortrait";

export default function GamesPage(){return <div className="page-wrap"><header className="content-header"><div><span className="eyebrow">GAME LIBRARY</span><h1>Practice without feeling like a test.</h1><p>Eight 3D fair games and twelve English learning activities. Explore, make friends and practise a little every day.</p></div><span className="mode-badge">20 GAMES & ACTIVITIES</span></header><section className="game-grid">{games.map((game)=><Link className="game-card playable" href={game.href} key={game.slug}>{companionForPath(game.href) ? <CompanionPortrait id={companionForPath(game.href)!.id}/> : <span className="game-icon">{game.icon}</span>}<span className="game-skill">{game.skill}</span><h2>{game.name}</h2><p>{game.description}</p><div><small>◷ {game.minutes} min</small><b>Play →</b></div></Link>)}{festivalGames.map(game=><Link className="game-card playable" href={`/festival/${game.id}`} key={game.id}><CompanionPortrait id={game.host}/><span className="game-skill">3D FAIR · {game.skill}</span><h2>{game.name}</h2><p>{game.description}</p><div><small>With {companionById(game.host).name}</small><b>Play →</b></div></Link>)}</section></div>}

