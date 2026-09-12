import Link from "next/link";
import GameArt from "./GameArt";
export default function VillageWelcome() {
  return <section className="village-welcome" aria-label="Welcome to Sunlit Village"><div className="village-welcome-copy"><span className="eyebrow">WELCOME TO LÀNG NẮNG</span><h2>Big adventures start<br />with little words.</h2><p>A café conversation. A journey somewhere new.<br />Your English has a whole world to grow into.</p><Link href="/worlds" className="button primary">Let’s explore the village <span aria-hidden="true">↗</span></Link></div><div className="village-welcome-scene" aria-hidden="true"><GameArt id="bubble-tree" className="welcome-tree" /><GameArt id="training-school" className="welcome-school" /><GameArt id="conversation-cafe" className="welcome-cafe" /><GameArt id="mam" className="welcome-mam" /><GameArt id="flower-bush" className="welcome-bush" /></div></section>;
}
