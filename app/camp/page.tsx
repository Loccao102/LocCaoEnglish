import Link from "next/link";
import VillageWelcome from "@/components/VillageWelcome";
import SkillMap from "@/components/SkillMap";
import AdaptivePlan from "@/components/AdaptivePlan";
import LiveSnapshot from "@/components/LiveSnapshot";
import DailyQuestBoard from "@/components/DailyQuestBoard";
import CampaignSpotlight from "@/components/CampaignSpotlight";
import WorldSelect from "@/components/WorldSelect";
import { games } from "@/data/learning";
import { PracticeDashboardProvider } from "@/components/learning/usePracticeDashboard";
import "./practice.css";

export default function Camp() {
  return <PracticeDashboardProvider>
    <div className="page-wrap practice-camp">
      <header className="topbar">
        <div>
          <span className="eyebrow">PRACTICE & PROGRESS</span>
          <h1>Your learning journal.</h1>
          <p>See your recent checked work, revisit mistakes, and choose a next step for your learning goal.</p>
        </div>
        <div className="top-actions">
          <Link className="button ghost" href="/onboarding">Set your learning goal</Link>
          <Link className="button primary" href="/progress">View personal progress →</Link>
        </div>
      </header>
      <VillageWelcome />
      <LiveSnapshot />
      <section className="hero-grid"><CampaignSpotlight /><DailyQuestBoard /></section>
      <AdaptivePlan />
      <section className="panel">
        <div className="section-heading">
          <div><span className="eyebrow">WORLD SELECT</span><h2>Choose where to play next</h2></div>
          <Link href="/progress" className="text-link">View progress →</Link>
        </div>
        <WorldSelect />
      </section>
      <SkillMap />
      <section className="split-grid">
        <article className="panel">
          <div className="section-heading">
            <div><span className="eyebrow">ARCADE</span><h2>Short practice sessions</h2></div>
            <Link href="/games" className="text-link">All games →</Link>
          </div>
          <div className="quick-games">{games.slice(0, 4).map(game => <Link className="quick-game" href={game.href} key={game.slug}>
            <span>{game.icon}</span>
            <div><strong>{game.name}</strong><small>{game.skill} · {game.minutes} min</small></div>
            <b>→</b>
          </Link>)}</div>
        </article>
        <article className="panel">
          <div className="section-heading"><div><span className="eyebrow">BUILD A PRACTICE HABIT</span><h2>Make each session count</h2></div></div>
          <ol className="practice-habit">
            <li>Choose a guided activity for your goal.</li>
            <li>Read the feedback and revisit mistakes.</li>
            <li>Return to your journal to see your recent work.</li>
            <li>Follow your saved daily checklist at your own pace.</li>
          </ol>
        </article>
      </section>
    </div>
  </PracticeDashboardProvider>;
}
