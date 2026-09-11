import ReviewTrainer from "@/components/ReviewTrainer";

export default function ReviewPage() { return <div className="page-wrap narrow-page"><header className="simple-header"><span className="eyebrow">SPACED REPETITION</span><h1>Review queue</h1><p>Wrong answers from games are scheduled here automatically. Your next interval changes based on how easily you recall them.</p></header><ReviewTrainer /></div>; }
