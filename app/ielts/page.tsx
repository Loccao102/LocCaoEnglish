import WritingLab from "@/components/WritingLab";

export default function IeltsPage(){return <div className="page-wrap"><header className="content-header"><div><span className="eyebrow">IELTS MODE · WRITING</span><h1>Writing Lab</h1><p>The scoring pipeline uses the four IELTS Writing criteria. If the AI service has a configured model, feedback comes from that coach; otherwise a transparent local heuristic keeps practice available.</p></div><span className="mode-badge warning">Practice estimate · not official IELTS</span></header><WritingLab/></div>}
