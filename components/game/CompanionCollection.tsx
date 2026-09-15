"use client";

import { useState, type CSSProperties } from "react";
import { companions } from "@/lib/game/catalog";
import { companionFamilies } from "@/lib/game/companions";
import CompanionPortrait from "./CompanionPortrait";

export default function CompanionCollection({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  const [family, setFamily] = useState("All friends");
  const visible = companions.filter(friend => family === "All friends" || friend.family === family);
  return <div className="companion-collection">
    <div className="companion-filters" role="group" aria-label="Character families">
      {["All friends", ...companionFamilies].map(group => <button key={group} aria-pressed={family === group} onClick={() => setFamily(group)}>
        {group}{group === "All friends" ? ` · ${companions.length}` : ""}
      </button>)}
    </div>
    <div className="companion-roster">
      {visible.map(friend => <button className="companion-card" key={friend.id} aria-pressed={selected === friend.id} onClick={() => onSelect(friend.id)} style={{ "--friend-tint": friend.design.skin } as CSSProperties}>
        <CompanionPortrait id={friend.id}/><strong>{friend.name}</strong><span>{friend.role}</span>
        {selected === friend.id && <i aria-hidden="true">✓</i>}
      </button>)}
    </div>
  </div>;
}
