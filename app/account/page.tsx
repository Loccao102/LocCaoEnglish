import AuthPanel from "@/components/AuthPanel";

export default function AccountPage() {
  return <div className="page-wrap narrow-page"><header className="simple-header"><span className="eyebrow">PROFILE & SYNC</span><h1>Your learner account</h1><p>Sign in when you want progress to persist to your PostgreSQL-backed profile.</p></header><AuthPanel /></div>;
}
