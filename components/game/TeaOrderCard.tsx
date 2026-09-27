"use client";

import { companionById } from "@/lib/game/companions";
import { teaGuest, teaIngredients, teaStrength, teaStrengths } from "@/lib/game/tea-service";
import type { FairState } from "@/lib/game/festival-session";

export default function TeaOrderCard({state,canAct,onHint}:{state:FairState;canAct:boolean;onHint:()=>void}) {
  const tea=state.tea,guest=teaGuest(tea,state.round);
  if(!tea||!guest)return null;
  const band=teaStrengths[guest.strength],strength=teaStrength(tea.seconds);
  return <section className="tea-order-card" data-stage={tea.stage} aria-label="Visiting friend's order">
    <div className="tea-order-heading"><strong>{companionById(guest.id).name}’s cup · {band.name}</strong><button onClick={onHint} disabled={!canAct} aria-expanded={tea.hint}>Recipe card</button></div>
    {tea.hint&&<p>{guest.recipe.map(id=>teaIngredients[id]).join(" → ")} · lift at {band.from}–{band.to} seconds.</p>}
    <div className="tea-steep-meter" role="meter" aria-label="Tea steeping time" aria-valuemin={0} aria-valuemax={8} aria-valuenow={Number(tea.seconds.toFixed(1))} aria-valuetext={`${tea.seconds.toFixed(1)} seconds. Target ${band.name}: ${band.from} to ${band.to} seconds.`}>
      <span className="tea-target-band" style={{left:`${band.from/8*100}%`,width:`${(band.to-band.from)/8*100}%`}}/>
      <i style={{left:`${Math.min(98,tea.seconds/8*100)}%`}}/>
    </div>
    <div className="tea-steep-caption"><span>{tea.stage==="mixing"?"1 · Add ingredients":tea.stage==="steeping"?"2 · Lift inside the marked band":"3 · Ready to serve"}</span><strong>{tea.stage==="mixing"?`${band.from}–${band.to}s`: `${tea.seconds.toFixed(1)}s`}{tea.stage==="ready"?` · ${strength>=0?teaStrengths[strength].name:"Outside band"}`:""}</strong></div>
  </section>;
}
