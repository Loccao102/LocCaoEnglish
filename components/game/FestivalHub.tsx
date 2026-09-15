"use client";

import Link from "next/link";
import { festivalGames } from "@/lib/game/festival";
import { companionById } from "@/lib/game/companions";
import { personalityFor } from "@/lib/game/personalities";
import {useFairProgress} from "./FairProgressProvider";
import FairSaveStatus from "./FairSaveStatus";
import CompanionPortrait from "./CompanionPortrait";

export default function FestivalHub(){
  const {save,courses}=useFairProgress();
  const stamps=festivalGames.filter(game=>save.games[game.id]?.stars).length;
  return <div className="fair-hub page-wrap"><header className="fair-hub-hero"><div><p className="eyebrow">A NEW CHAPTER IN SUNLIT VILLAGE</p><h1>The Friendship<br/><em>Fair.</em></h1><p>Across the little wooden bridge, eight friends have made something just for you. Come for a game. Stay for a story.</p><div className="fair-hub-actions"><Link className="button primary" href="/play?arrival=fair">Walk into the fair →</Link><Link className="button ghost" href="/characters">Meet all 24 friends</Link></div></div><div className="fair-scrapbook-cover"><div className="fair-cover-friends">{["mam","com","may"].map(id=><CompanionPortrait id={id} key={id}/>)}</div><span>YOUR FRIENDSHIP SCRAPBOOK</span><strong>{stamps}<small> / 8</small></strong><p>little memories collected</p><div aria-label={`${stamps} of 8 friendship stamps`}>{festivalGames.map(game=><span key={game.id} title={game.name} data-collected={!!save.games[game.id]?.stars}>{save.games[game.id]?.stars?"✿":"○"}</span>)}</div></div></header>
    <div className="fair-section-heading"><div><span className="eyebrow">PICK A LITTLE ADVENTURE</span><h2>Eight ways to play together.</h2></div><p>No chapter locks. Every game is open.</p></div><FairSaveStatus/>
    <section className="fair-game-grid" aria-label="Friendship Fair games">{festivalGames.map((game,index)=>{const friend=companionById(game.host),personality=personalityFor(game.host),record=save.games[game.id];return <article className="fair-card" key={game.id} style={{"--fair-colour":game.colour} as React.CSSProperties}><Link className="fair-card-art" href={`/festival/${game.id}`} tabIndex={-1} aria-hidden="true"><span className="fair-card-number">0{index+1}</span><CompanionPortrait id={game.host}/><span className="fair-card-stamp">{record?.stars?"★".repeat(record.stars):game.skill}</span></Link><div className="fair-card-body"><span className="eyebrow">{friend.name} · {personality.trait}</span><h3><Link href={`/festival/${game.id}`}>{game.name}</Link></h3><p>{game.description}</p>{game.kind==="hop"&&<p className="cloud-hub-progress">Mây’s sky atlas · {Object.keys(courses).length} / 6 courses · {Object.values(courses).reduce((sum,course)=>sum+course.medals,0)} / 18 badges</p>}<div className="fair-card-foot"><small>{record?`Best ${record.best} · ${record.visits} ${record.visits===1?"memory":"memories"} made`:`${game.rounds} rounds · first memory waiting`}</small><Link href={`/festival/${game.id}`} aria-label={`Play ${game.name}`}>Play →</Link></div></div><div className="fair-memory" data-unlocked={!!record?.stars}><span>{record?.stars?"✿ A MEMORY TO KEEP":"♡ A FRIENDSHIP TO GROW"}</span><p>{record?.stars?game.memory:`Finish ${friend.name}’s game to add a little story to your scrapbook.`}</p></div></article>;})}</section>
    <footer className="fair-footer"><p>Every memory has a place in your journey. Sign in to keep your fair scrapbook and village story across devices.</p><Link href="/journey">Open my complete journey →</Link><Link href="/games">All 20 games & learning activities →</Link></footer></div>;
}
