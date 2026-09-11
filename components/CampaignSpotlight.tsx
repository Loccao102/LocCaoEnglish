"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BossState, getProgression, ProgressionState } from "@/lib/api";

export default function CampaignSpotlight(){
  const[state,setState]=useState<ProgressionState|null>(null);
  useEffect(()=>{getProgression().then(setState).catch(()=>setState(null))},[]);
  const boss=useMemo(()=>{if(!state)return null;const open=state.bosses.find(item=>!item.cleared&&item.unlocked);return open??state.bosses.find(item=>!item.cleared)??null},[state]);
  if(!state)return <article className="continue-card"><div className="continue-copy"><span className="eyebrow light">CURRENT RUN</span><h2>Open your next challenge.</h2><p>Start the API to let Camp read your live world progression.</p><Link href="/worlds" className="button bright">Open world map →</Link></div></article>;
  if(!boss)return <article className="continue-card"><div className="continue-copy"><span className="eyebrow light">TRAVEL DISTRICT COMPLETE</span><h2>Passport stamped.</h2><p>You cleared Airport, Hotel and City Transit. Equip your mastery rewards or move into another world.</p><div className="mission-meta"><span>♛ 3/3 chapters</span><span>✓ district clear</span></div><Link href="/worlds" className="button bright">Choose next world →</Link></div><div className="mission-orbit"><span className="plane">♛</span><i className="orbit one"/><i className="orbit two"/></div></article>;
  return <BossSpotlight boss={boss}/>;
}

function BossSpotlight({boss}:{boss:BossState}){
  const ready=boss.checkpoints.filter(item=>item.complete).length;
  const next=boss.checkpoints.find(item=>!item.complete);
  return <article className="continue-card"><div className="continue-copy"><span className="eyebrow light">{boss.unlocked?"BOSS GATE OPEN":"CURRENT CAMPAIGN"}</span><h2>{boss.title}</h2><p>{boss.unlocked?"Your evidence is ready. Enter the role-play and satisfy the real communication objectives.":`Prepare this chapter: ${ready}/${boss.checkpoints.length} evidence checkpoints complete.`}</p><div className="mission-meta"><span>✦ {ready}/{boss.checkpoints.length} proof</span><span>+{boss.rewardXp} XP</span><span>{boss.unlocked?"NPC ready":"evidence-gated"}</span></div>{boss.unlocked?<Link href={boss.route} className="button bright">Enter boss fight →</Link>:next?<Link href={next.route} className="button bright">Build {next.skill} proof →</Link>:<Link href="/travel" className="button bright">Open campaign →</Link>}</div><div className="mission-orbit"><span className="plane">{boss.id==="airport-crisis"?"✈":boss.id==="hotel-reservation"?"◆":"◎"}</span><i className="orbit one"/><i className="orbit two"/></div></article>;
}
