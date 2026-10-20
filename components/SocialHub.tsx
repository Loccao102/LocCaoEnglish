"use client";

import Link from "next/link";
import {useCallback, useEffect, useRef, useState} from "react";
import {createChallenge, getChallenges, getLeaderboard, getOnline, touchPresence, type Challenge, type LeaderboardEntry, type Presence} from "@/lib/api";
import {socialEventsURL} from "@/lib/realtime";

export default function SocialHub() {
  const [leaders,setLeaders]=useState<LeaderboardEntry[]>([]), [online,setOnline]=useState<Presence[]>([]), [challenges,setChallenges]=useState<Challenge[]>([]);
  const [error,setError]=useState(""), [live,setLive]=useState(false), [creating,setCreating]=useState(false);
  const [disclaimer,setDisclaimer]=useState("Loading the checked-practice board…");
  const active=useRef(false), sequence=useRef(0), creation=useRef(false);
  const refresh=useCallback(async () => {
    const seq=++sequence.current;
    try {
      const [board,people,invites]=await Promise.all([getLeaderboard(),getOnline(),getChallenges()]);
      if (!active.current || seq!==sequence.current) return;
      const checked=board.method==="server-checked-practice.v1";
      setLeaders(checked ? board.items : []);
      setDisclaimer(checked ? board.disclaimer : "The checked-practice board is unavailable. Lifetime XP is not a verified rank.");
      setOnline(people.items);setChallenges(invites.items);setError("");
    } catch(e) {if(active.current && seq===sequence.current)setError(e instanceof Error ? e.message : "Could not refresh the community.");}
  },[]);
  useEffect(() => {
    active.current=true;void touchPresence().catch(()=>{});void refresh();
    const heartbeat=window.setInterval(()=>void touchPresence().catch(()=>{}),20000);
    const poll=window.setInterval(()=>void refresh(),30000);
    let source:EventSource|null=null;
    if("EventSource" in window){source=new EventSource(socialEventsURL());source.onopen=()=>setLive(true);source.onmessage=()=>void refresh();source.onerror=()=>setLive(false);}
    return()=>{active.current=false;sequence.current++;clearInterval(heartbeat);clearInterval(poll);source?.close();};
  },[refresh]);
  async function create() {
    if(creation.current)return;creation.current=true;setCreating(true);
    try{await createChallenge("Word Link practice invitation");await refresh();}
    catch(e){if(active.current)setError(e instanceof Error?e.message:"Could not create an invitation.");}
    finally{creation.current=false;if(active.current)setCreating(false);}
  }
  return <div className="social-grid"><section className="panel social-main">
    <div className="section-heading"><div><span className="eyebrow">PRACTICE INVITATIONS · {live?"LIVE":"RECONNECTING"}</span><h2>Practise Word Link together</h2></div>
      <button className="button primary" disabled={creating} onClick={()=>void create()}>{creating?"Creating invitation…":"Create practice invitation"}</button></div>
    <p>Invitations open ordinary practice. They do not create head-to-head scores or decide a winner.</p>
    {error&&<div className="notice error" role="alert">{error}</div>}
    <div className="challenge-list">{!challenges.length&&<p className="muted">No practice invitations yet.</p>}
      {challenges.map(ch=><article className="challenge-card" key={ch.id}><div><span className="challenge-status">{ch.status==="open"?"Practice invitation":"Archived invitation"}</span><h3>{ch.title}</h3><p>Created by {ch.creatorName} · {ch.skill}</p></div>
        {!!ch.entries.length&&<details><summary>Older reported results · unverified</summary><div className="challenge-entries">{ch.entries.map(entry=><span key={entry.userId}><b>{entry.displayName}</b><strong>Reported: {entry.score}</strong></span>)}</div><p>These client-reported results do not count toward checked-practice rank.</p></details>}
        <Link className="button ghost" href="/games/word-link">Open practice →</Link>
      </article>)}
    </div></section><aside className="social-side"><section className="panel"><span className="eyebrow">CHECKED PRACTICE XP</span><p>{disclaimer}</p>
      {!leaders.length&&<p>No eligible practice receipts yet. Complete a checked learning round to appear here.</p>}
      <div className="leader-list">{leaders.map(item=><div key={item.userId}><b>#{item.rank}</b><span className={item.online?"online-dot on":"online-dot"}/><strong>{item.displayName}</strong><em>{item.xp} checked XP</em></div>)}</div>
    </section><section className="panel"><span className="eyebrow">ONLINE NOW · {online.length}</span><div className="online-list">{online.map(user=><span key={user.userId}><i className="online-dot on"/>{user.displayName}</span>)}</div></section></aside></div>;
}
