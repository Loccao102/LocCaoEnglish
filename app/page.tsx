import Link from "next/link";
import SkillMap from "@/components/SkillMap";
import { dailyQuests, games, skills } from "@/data/learning";

export default function Home() {
  const completed = dailyQuests.filter((q) => q.done).length;
  const questPercent = Math.round((completed / dailyQuests.length) * 100);

  return (
    <div className="page-wrap">
      <header className="topbar">
        <div><span className="eyebrow">FRIDAY · PERSONAL PLAN</span><h1>Good afternoon, ready to level up?</h1><p>Your weak areas today are <b>Speaking</b> and <b>Writing</b>. We built a short route around them.</p></div>
        <div className="top-actions"><span className="streak">🔥 <strong>17</strong> days</span><Link className="button ghost" href="/games">Browse games</Link></div>
      </header>

      <section className="stats-grid">
        <article className="stat-card accent"><span className="stat-icon">A</span><div><small>English level</small><strong>B1+</strong><span>toward B2</span></div></article>
        <article className="stat-card"><span className="stat-icon">7</span><div><small>IELTS estimate</small><strong>6.0</strong><span>target 7.0</span></div></article>
        <article className="stat-card"><span className="stat-icon">↑</span><div><small>Weekly XP</small><strong>1,240</strong><span>+18% vs last week</span></div></article>
        <article className="stat-card"><span className="stat-icon">◎</span><div><small>Words mastered</small><strong>684</strong><span>42 learning</span></div></article>
      </section>

      <section className="hero-grid">
        <article className="continue-card">
          <div className="continue-copy"><span className="eyebrow light">CONTINUE YOUR JOURNEY</span><h2>Airport Mission</h2><p>Handle check-in, understand an announcement and talk to an airline employee.</p><div className="mission-meta"><span>✦ 4 stages</span><span>◷ 12 min</span><span>+90 XP</span></div><Link href="/games/word-link" className="button bright">Continue mission →</Link></div>
          <div className="mission-orbit"><span className="plane">✈</span><i className="orbit one" /><i className="orbit two" /></div>
        </article>

        <article className="panel quest-card">
          <div className="section-heading"><div><span className="eyebrow">DAILY QUEST</span><h2>{questPercent}% complete</h2></div><span className="xp-pill">+120 XP</span></div>
          <div className="progress large"><i style={{ width: `${questPercent}%` }} /></div>
          <div className="quest-list">
            {dailyQuests.map((quest) => <div className={`quest ${quest.done ? "done" : ""}`} key={quest.label}><span className="check">{quest.done ? "✓" : ""}</span><span>{quest.label}</span><small>+{quest.xp}</small></div>)}
          </div>
        </article>
      </section>

      <SkillMap />

      <section className="split-grid">
        <article className="panel">
          <div className="section-heading"><div><span className="eyebrow">LEARNING FINGERPRINT</span><h2>Your skills</h2></div><span className="muted">updated today</span></div>
          <div className="skill-bars">
            {skills.map((skill) => <div className="skill-row" key={skill.name}><div><strong>{skill.name}</strong><small>Lv. {skill.level}</small></div><div className="progress"><i className={skill.tone} style={{ width: `${skill.confidence}%` }} /></div><b>{skill.confidence}%</b></div>)}
          </div>
        </article>

        <article className="panel">
          <div className="section-heading"><div><span className="eyebrow">RECOMMENDED</span><h2>Quick games</h2></div><Link href="/games" className="text-link">View all →</Link></div>
          <div className="quick-games">
            {games.slice(0, 3).map((game) => {
              const href = game.slug === "word-link" ? "/games/word-link" : `/${game.slug}`;
              return <Link className="quick-game" href={href} key={game.slug}><span>{game.icon}</span><div><strong>{game.name}</strong><small>{game.skill} · {game.minutes} min</small></div><b>→</b></Link>;
            })}
          </div>
        </article>
      </section>
    </div>
  );
}
