"use client";

import { useMemo, useState } from "react";

const task = "Some people believe that governments should invest more money in public transport than in building new roads. To what extent do you agree or disagree?";
const connectors = ["however", "therefore", "moreover", "furthermore", "although", "because", "consequently", "nevertheless", "while", "whereas", "firstly", "secondly", "overall"];

const clamp = (value: number) => Math.min(8, Math.max(4, value));
const half = (value: number) => Math.round(value * 2) / 2;

export default function WritingLab() {
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const stats = useMemo(() => {
    const words = text.trim() ? text.trim().split(/\s+/) : [];
    const lower = text.toLowerCase();
    const paragraphs = text.split(/\n\s*\n/).filter((item) => item.trim()).length;
    const connectorCount = connectors.filter((word) => lower.includes(word)).length;
    const unique = new Set(words.map((word) => word.toLowerCase().replace(/[^a-z]/g, "")).filter(Boolean)).size;
    const lexicalRatio = words.length ? unique / words.length : 0;
    const sentences = text.split(/[.!?]+/).filter((item) => item.trim());
    const avgSentence = sentences.length ? words.length / sentences.length : 0;

    const taskResponse = half(clamp(4 + (words.length >= 120 ? 1 : 0) + (words.length >= 220 ? 1 : 0) + (words.length >= 250 ? .5 : 0) + (paragraphs >= 3 ? .5 : 0)));
    const coherence = half(clamp(4 + Math.min(1.5, connectorCount * .25) + (paragraphs >= 4 ? 1 : paragraphs >= 2 ? .5 : 0) + (avgSentence >= 10 && avgSentence <= 28 ? .5 : 0)));
    const lexical = half(clamp(4 + (words.length >= 150 ? .5 : 0) + (lexicalRatio >= .55 ? 1.5 : lexicalRatio >= .42 ? 1 : .5) + (words.length >= 250 ? .5 : 0)));
    const grammar = half(clamp(4 + (sentences.length >= 8 ? .75 : .25) + (avgSentence >= 12 ? .75 : .25) + (lower.includes("although") || lower.includes("while") || lower.includes("whereas") ? .5 : 0)));
    const overall = half((taskResponse + coherence + lexical + grammar) / 4);
    return { words: words.length, paragraphs, connectorCount, lexicalRatio, taskResponse, coherence, lexical, grammar, overall };
  }, [text]);

  return (
    <div className="writing-layout">
      <section className="writing-workspace">
        <div className="task-box"><span>IELTS WRITING TASK 2</span><p>{task}</p><small>Write at least 250 words. Suggested time: 40 minutes.</small></div>
        <textarea className="practice-textarea essay" value={text} onChange={(e) => { setText(e.target.value); setSubmitted(false); }} placeholder="Write your essay here…" />
        <div className="editor-footer"><span className={stats.words >= 250 ? "good" : ""}>{stats.words} words</span><span>{stats.paragraphs} paragraphs</span><button className="button primary" disabled={stats.words < 40} onClick={() => setSubmitted(true)}>Estimate band</button></div>
      </section>

      <aside className="score-panel">
        <div><span className="eyebrow">PRACTICE ESTIMATE</span><div className="big-band">{submitted ? stats.overall.toFixed(1) : "—"}<small>band</small></div><p>This MVP uses transparent local heuristics to test the UX. It is not an official IELTS score or a substitute for examiner feedback.</p></div>
        <div className="rubric-list">
          {[ ["Task Response", stats.taskResponse], ["Coherence & Cohesion", stats.coherence], ["Lexical Resource", stats.lexical], ["Grammar Range", stats.grammar] ].map(([label, value]) => <div className="rubric" key={String(label)}><div><strong>{label}</strong><b>{submitted ? Number(value).toFixed(1) : "—"}</b></div><div className="progress"><i style={{ width: submitted ? `${(Number(value) / 9) * 100}%` : "0%" }} /></div></div>)}
        </div>
        {submitted && <div className="coach-notes"><strong>What the engine noticed</strong><ul><li>{stats.words >= 250 ? "You reached the expected Task 2 length." : "Build toward 250+ words with a clearer developed position."}</li><li>{stats.connectorCount >= 4 ? "You are using several linking devices." : "Add linking devices only where the logic needs them."}</li><li>{stats.paragraphs >= 4 ? "Paragraph structure is visible." : "Use a clear introduction, body paragraphs and conclusion."}</li></ul></div>}
      </aside>
    </div>
  );
}
