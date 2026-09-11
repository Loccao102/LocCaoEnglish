import Link from "next/link";
import SkillMap from "@/components/SkillMap";
import AdaptivePlan from "@/components/AdaptivePlan";
import LiveSnapshot from "@/components/LiveSnapshot";
import { games } from "@/data/learning";

const worlds = [
  { title: "Travel District", tag: "CAMPAIGN", copy: "Airport, hotel, transport and real-life survival English.", href: "/courses", icon: "✈" },
  { title: "Word Network", tag: "EXPLORATION", copy: "Grow vocabulary as a graph of meaning, collocation and word families.", href: "/word-graph", icon: "◇" },
  { title: "Battle Arena", tag: "SOCIAL", copy: "Challenge other learners and climb the XP leaderboard.", href: "/social", icon: "⚔" },
  { title: "IELTS Tower", tag: "CHALLENGE MODE", copy: "Clear Listening, Reading, Writing and Speaking floors, then calculate your overall estimate.", href: "/ielts", icon: "▤" },
];

export default function Home() {
  return (
    <div className="page-wrap">
      <header className="topbar">
        <div>
          <span className="eyebrow">ENGLISH ADVENTURE</span>
          <h1>Your next quest is ready.</h1>
          <p>Every answer changes your build. Weak skills create recovery quests; mastered skills unlock harder missions.</p>
        </div>
        <div className="top-actions">
          <span className="streak">🔥 keep the run alive</span>
          <Link className="button ghost" href="/learn">Continue journey →</Link>
        </div>
      </header>

      <LiveSnapshot />

      <section className="hero-grid">
        <article className="continue-card">
          <div className="continue-copy">
            <span className="eyebrow light">CURRENT BOSS</span>
            <h2>Missed Flight</h2>
            <p>Survive four stages: vocabulary, announcement listening, spoken explanation and a live AI airline-agent negotiation.</p>
            <div className="mission-meta">
              <span>✦ 4 stages</span><span>◷ 15 min</span><span>+150 XP</span>
            </div>
            <Link href="/missions/airport" className="button bright">Enter boss fight →</Link>
          </div>
          <div className="mission-orbit"><span className="plane">✈</span><i className="orbit one"/><i className="orbit two"/></div>
        </article>

        <article className="panel quest-card">
          <div className="section-heading">
            <div><span className="eyebrow">DAILY RUN</span><h2>One short run, real progress</h2></div>
            <span className="xp-pill">adaptive</span>
          </div>
          <p className="muted">The director chooses today&apos;s route from your weakest skills and review queue. Finish the run before free-playing other modes.</p>
          <div className="quest-list">
            <div className="quest"><span className="check">1</span><span>Recover a weak skill</span><small>smart pick</small></div>
            <div className="quest"><span className="check">2</span><span>Use it in context</span><small>mission</small></div>
            <div className="quest"><span className="check">3</span><span>Bank the XP</span><small>streak</small></div>
          </div>
          <Link href="/review" className="button primary wide">Open recovery queue →</Link>
        </article>
      </section>

      <AdaptivePlan />

      <section className="panel">
        <div className="section-heading">
          <div><span className="eyebrow">WORLD SELECT</span><h2>Choose where to play next</h2></div>
          <Link href="/courses" className="text-link">See campaigns →</Link>
        </div>
        <div className="quick-games">
          {worlds.map((world) => (
            <Link className="quick-game" href={world.href} key={world.title}>
              <span>{world.icon}</span>
              <div><small>{world.tag}</small><strong>{world.title}</strong><small>{world.copy}</small></div>
              <b>→</b>
            </Link>
          ))}
        </div>
      </section>

      <SkillMap />

      <section className="split-grid">
        <article className="panel">
          <div className="section-heading">
            <div><span className="eyebrow">ARCADE</span><h2>Quick XP runs</h2></div>
            <Link href="/games" className="text-link">All games →</Link>
          </div>
          <div className="quick-games">
            {games.slice(0, 4).map((game) => (
              <Link className="quick-game" href={game.href} key={game.slug}>
                <span>{game.icon}</span>
                <div><strong>{game.name}</strong><small>{game.skill} · {game.minutes} min</small></div>
                <b>→</b>
              </Link>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="section-heading">
            <div><span className="eyebrow">HOW THE GAME LEARNS YOU</span><h2>Mistakes become content</h2></div>
          </div>
          <div className="quest-list">
            <div className="quest"><span className="check">①</span><span>Play any quest or mini-game</span><small>evidence</small></div>
            <div className="quest"><span className="check">②</span><span>Weak concepts enter Recovery</span><small>SRS</small></div>
            <div className="quest"><span className="check">③</span><span>Daily quests adapt automatically</span><small>AI + rules</small></div>
            <div className="quest"><span className="check">④</span><span>Bosses force you to use skills together</span><small>mastery</small></div>
          </div>
        </article>
      </section>
    </div>
  );
}
