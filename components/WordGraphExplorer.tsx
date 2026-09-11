"use client";

import { useMemo, useState } from "react";
import { recordAttempt } from "@/lib/api";

type Node={id:string;label:string;x:number;y:number;kind:string;definition:string};
type Edge={from:string;to:string;label:string};
const nodes:Node[]=[
{id:"travel",label:"TRAVEL",x:50,y:48,kind:"topic",definition:"Movement from one place to another."},
{id:"airport",label:"airport",x:20,y:20,kind:"place",definition:"A place where aircraft take off and land."},
{id:"flight",label:"flight",x:80,y:18,kind:"noun",definition:"A journey made by air."},
{id:"delay",label:"delay",x:16,y:72,kind:"noun / verb",definition:"A period of waiting caused by something being late."},
{id:"boarding",label:"boarding",x:83,y:72,kind:"process",definition:"The process of getting onto an aircraft."},
{id:"gate",label:"gate",x:50,y:12,kind:"place",definition:"The area where passengers board a flight."},
{id:"miss",label:"miss a flight",x:50,y:86,kind:"collocation",definition:"Fail to catch a scheduled flight."},
{id:"departure",label:"departure",x:33,y:42,kind:"noun",definition:"The act of leaving a place."},
{id:"arrival",label:"arrival",x:69,y:44,kind:"noun",definition:"The act of reaching a destination."},
];
const edges:Edge[]=[{from:"travel",to:"airport",label:"place"},{from:"travel",to:"flight",label:"journey"},{from:"airport",to:"gate",label:"contains"},{from:"flight",to:"boarding",label:"before"},{from:"flight",to:"delay",label:"can have"},{from:"flight",to:"miss",label:"collocation"},{from:"flight",to:"departure",label:"start"},{from:"flight",to:"arrival",label:"end"},{from:"departure",to:"arrival",label:"opposites"}];

export default function WordGraphExplorer(){const [selected,setSelected]=useState("travel");const [source,setSource]=useState<string|null>(null);const [message,setMessage]=useState("Click any node to inspect it, or start Link Mode to test relationships.");const active=nodes.find((n)=>n.id===selected)!;const lines=useMemo(()=>edges.map((e)=>({e,a:nodes.find((n)=>n.id===e.from)!,b:nodes.find((n)=>n.id===e.to)!})),[]);
function click(id:string){setSelected(id);if(!source)return;if(source===id){setSource(null);setMessage("Link Mode cancelled.");return}const edge=edges.find((e)=>(e.from===source&&e.to===id)||(e.to===source&&e.from===id));const a=nodes.find((n)=>n.id===source)!;const b=nodes.find((n)=>n.id===id)!;const ok=Boolean(edge);setMessage(ok?`Correct: ${a.label} ↔ ${b.label} (${edge!.label})`:`No direct link in this map. Try another node.`);recordAttempt({skill:"Vocabulary",activity:"word-graph",itemKey:`graph:${source}:${id}`,prompt:`Connect ${a.label} to a related node`,answer:edge?.label||"no direct relation",accuracy:ok?1:0}).catch(()=>{});setSource(null)}
return <section className="graph-explorer"><div className="graph-toolbar"><div><span className="eyebrow">KNOWLEDGE GRAPH</span><h1>Travel word constellation</h1></div><button className="button ghost" onClick={()=>{setSource(selected);setMessage(`Link Mode: choose a node related to ${active.label}.`)}}>Start Link Mode</button></div><div className="graph-grid"><div className="graph-canvas"> <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{lines.map(({e,a,b})=><line key={`${e.from}-${e.to}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}/>)}</svg>{nodes.map((n)=><button key={n.id} onClick={()=>click(n.id)} className={`graph-node ${selected===n.id?"active":""} ${source===n.id?"source":""}`} style={{left:`${n.x}%`,top:`${n.y}%`}}><small>{n.kind}</small><strong>{n.label}</strong></button>)}</div><aside className="graph-inspector"><span className="eyebrow">SELECTED NODE</span><h2>{active.label}</h2><small>{active.kind}</small><p>{active.definition}</p><div className="graph-relations"><strong>Connections</strong>{edges.filter((e)=>e.from===active.id||e.to===active.id).map((e)=>{const other=nodes.find((n)=>n.id===(e.from===active.id?e.to:e.from))!;return <button key={`${e.from}${e.to}`} onClick={()=>click(other.id)}><span>{e.label}</span><b>{other.label}</b></button>})}</div><div className="graph-message">{message}</div></aside></div></section>}
