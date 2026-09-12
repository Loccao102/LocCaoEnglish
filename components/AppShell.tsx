import Link from "next/link";
import GameArt from "./GameArt";
import type { ReactNode } from "react";

const nav = [
  ["/", "⌂", "Camp"],
  ["/worlds", "◫", "World Map"],
  ["/learn", "⚑", "Quests"],
  ["/word-graph", "◇", "Word Network"],
  ["/games", "✦", "Arcade"],
  ["/social", "⚔", "Arena"],
  ["/review", "↻", "Recovery"],
  ["/ielts", "▤", "IELTS Tower"],
  ["/missions/airport", "☠", "Bosses"],
];

export default function AppShell({ children }: { children: ReactNode }) {
  return <div className="app-shell"><aside className="sidebar"><Link href="/" className="brand" aria-label="LocCao English player camp"><span className="brand-mark"><img src="/assets/sunlit-village/village-mark.svg" alt="" width="38" height="38"/></span><span><strong>LocCao</strong><small>English</small></span></Link><nav className="sidebar-nav" aria-label="Player navigation">{nav.map(([href, icon, label]) => <Link href={href} key={label} className="nav-item"><span className="nav-icon">{icon}</span><span>{label}</span></Link>)}</nav><div className="sidebar-bottom"><div className="level-card"><div className="level-row"><span>Quest director</span><strong>ADAPTIVE</strong></div><div className="progress"><i style={{ width: "72%" }} /></div><small>Your mistakes decide what challenge appears next.</small></div><Link href="/account" className="profile-mini"><GameArt id="mam" className="avatar"/><span><strong>Adventurer</strong><small>Profile & loadout →</small></span></Link></div></aside><main className="main-content">{children}</main></div>
}
