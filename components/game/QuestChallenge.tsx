"use client";

import { useEffect, useRef, useState } from "react";
import GameArt from "@/components/GameArt";
import { normalizeAnswer, type Verdict } from "@/lib/game/progress";
import type { Quest } from "@/lib/game/catalog";
import GameDialog from "./GameDialog";

export default function QuestChallenge({ quest, hidden, onPause, onComplete, onDone, finalPage }: {
  quest: Quest; hidden: boolean; onPause: () => void;
  onComplete: (answers: string[]) => Promise<Verdict>; onDone: (passed: boolean) => void; finalPage: boolean;
}) {
  const [index, setIndex] = useState(0), [answers, setAnswers] = useState<string[]>([]);
  const [value, setValue] = useState(""), [tokens, setTokens] = useState<number[]>([]);
  const [checked, setChecked] = useState(false), [transcript, setTranscript] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null), [saving, setSaving] = useState(false), [error, setError] = useState("");
  const submitLock = useRef(false), feedback = useRef<HTMLDivElement>(null), prompt = useRef<HTMLHeadingElement>(null);
  const question = quest.questions[index];
  const answer = question.kind === "order" ? tokens.map(token => question.options[token]).join(" ") : value;
  const correct = normalizeAnswer(answer) === normalizeAnswer(question.answer);

  useEffect(() => { if (index > 0) prompt.current?.focus(); }, [index]);

  useEffect(() => {
    if (hidden && "speechSynthesis" in window) window.speechSynthesis.cancel();
    return () => { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); };
  }, [hidden]);

  function check() {
    if (!answer.trim() || checked) return;
    setAnswers([...answers, answer]); setChecked(true);
    requestAnimationFrame(() => feedback.current?.focus());
  }
  async function finish() {
    if (submitLock.current) return;
    submitLock.current = true; setSaving(true); setError("");
    try { setVerdict(await onComplete(answers)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save. Please retry."); }
    finally { submitLock.current = false; setSaving(false); }
  }
  function next() {
    if (index === quest.questions.length - 1) { void finish(); return; }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setIndex(index + 1); setChecked(false); setValue(""); setTokens([]); setTranscript(false);
  }
  function retry() { setIndex(0); setAnswers([]); setValue(""); setTokens([]); setChecked(false); setTranscript(false); setVerdict(null); setError(""); }
  function listen() {
    if (!("speechSynthesis" in window)) { setTranscript(true); return; }
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(question.passage);
    speech.lang = "en-US"; speech.rate = .85; speech.onerror = () => setTranscript(true);
    window.speechSynthesis.speak(speech);
  }

  if (verdict) return <GameDialog title={verdict.passed ? finalPage && quest.id === "final-page" ? "The village shines again!" : quest.page ? "A Sun Page restored!" : "Quest complete!" : "A little more practice"} hidden={hidden} className="reward-dialog">
    <GameArt id={verdict.passed ? "chest-open" : "mam"} className="reward-art"/>
    <div className="quest-stars" aria-label={`${verdict.stars} of 3 stars`}>{[1, 2, 3].map(star => <span key={star} data-earned={star <= verdict.stars}>★</span>)}</div>
    <h3>{quest.title}</h3>
    <p>{verdict.passed ? quest.page ? "Your words brought another page home. A new corner of the village is ready to explore." : "The villagers are one step closer to finding their story." : "Get at least 2 of 3 answers right to complete this quest. Take your time — you can try again."}</p>
    <div className="reward-totals"><span><b>{verdict.correct}/3</b> correct</span><span><b>+{verdict.xp}</b> XP</span><span><b>+{verdict.coins}</b> sun coins</span></div>
    {verdict.passed && !verdict.firstClear && <p className="game-caption">Your best stars are saved. First-clear rewards have already been collected.</p>}
    {finalPage && quest.id === "final-page" && verdict.passed && <p className="story-ending">All seven pages are together. Thank you, adventurer. Visit your friends again, improve your stars, or discover more English in the learning journal.</p>}
    <div className="game-actions">{!verdict.passed && <button className="game-button" onClick={retry}>Try again</button>}<button className={`game-button ${verdict.passed ? "" : "secondary"}`} onClick={() => onDone(verdict.passed)}>Return to village →</button></div>
  </GameDialog>;

  return <GameDialog title={quest.title} hidden={hidden} onClose={onPause} className="challenge-dialog">
    <div className="challenge-meta"><span>CHALLENGE {index + 1} / {quest.questions.length}</span><span>2 correct answers to pass</span></div>
    <div className="challenge-progress" aria-label={`Question ${index + 1} of ${quest.questions.length}`}>{quest.questions.map((q, i) => <i key={i} data-state={i < index ? normalizeAnswer(answers[i] || "") === normalizeAnswer(q.answer) ? "correct" : "incorrect" : i === index ? "current" : "waiting"}/>)}</div>
    {question.passage && question.kind !== "listen" && <blockquote className="question-passage">{question.passage}</blockquote>}
    <h3 ref={prompt} tabIndex={-1} className="question-prompt">{question.prompt}</h3>
    {question.kind === "listen" && <div className="listening-tools"><button className="game-button secondary" onClick={listen}>♪ Listen</button><button className="game-text-button" onClick={() => setTranscript(!transcript)} aria-expanded={transcript}>{transcript ? "Hide" : "Read"} transcript</button>{transcript && <blockquote className="question-passage">{question.passage}</blockquote>}</div>}
    <form onSubmit={event => { event.preventDefault(); if (!checked) check(); }}>
      {(question.kind === "choice" || question.kind === "listen") && <div className="answer-options" role="group" aria-label="Choose your answer">{question.options.map((option, i) => <button type="button" key={option} disabled={checked} aria-pressed={value === option} className="answer-option" data-selected={value === option} onClick={() => setValue(option)}><span>{String.fromCharCode(65 + i)}</span>{option}</button>)}</div>}
      {question.kind === "type" && <label className="typed-answer">Your answer<input autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={200} disabled={checked} value={value} onChange={event => setValue(event.target.value)} placeholder="Type the missing word…"/></label>}
      {question.kind === "order" && <div className="word-builder"><div className="word-sentence" aria-label="Your sentence">{!tokens.length && <span>Tap the words to build a sentence.</span>}{tokens.map((token, i) => <button type="button" disabled={checked} key={token} onClick={() => setTokens(tokens.filter((_, index) => index !== i))} aria-label={`Remove ${question.options[token]}`}>{question.options[token]}</button>)}</div><div className="word-options">{question.options.map((word, i) => <button type="button" key={i} disabled={checked || tokens.includes(i)} onClick={() => setTokens([...tokens, i])}>{word}</button>)}</div></div>}
      {!checked && <button type="submit" className="game-button answer-check" disabled={!answer.trim()}>Check answer →</button>}
    </form>
    {checked && <div ref={feedback} tabIndex={-1} className="answer-feedback" data-correct={correct} role="status"><strong>{correct ? "✓ Nicely done!" : "Let’s learn this one."}</strong>{!correct && <p>Answer: <b>{question.answer}</b></p>}<p>{question.note}</p><button className="game-button" disabled={saving} onClick={next}>{saving ? "Saving your result…" : index === quest.questions.length - 1 ? "Finish quest →" : "Next challenge →"}</button></div>}
    {error && <p className="game-error" role="alert">{error} Your answers are still here. Press Finish quest to retry saving.</p>}
  </GameDialog>;
}
