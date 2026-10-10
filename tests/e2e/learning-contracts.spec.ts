import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import type { LearningAttempt, VerifiedLearningActivity } from "../../lib/learning-attempt";
import words from "../../backend/internal/learning/catalog.json";
import grammar from "../../backend/internal/learning/grammar_catalog.json";
import collocations from "../../backend/internal/learning/collocation_catalog.json";
import sentences from "../../backend/internal/learning/sentence_catalog.json";
import graph from "../../backend/internal/learning/word_graph_catalog.json";
import readings from "../../backend/internal/learning/reading_catalog.json";
import story from "../../backend/internal/learning/story_catalog.json";
import listening from "../../backend/internal/learning/listening_catalog.json";
import dictation from "../../backend/internal/learning/dictation_catalog.json";

const API = process.env.E2E_API_URL || "http://localhost:8080";
const activities: VerifiedLearningActivity[] = ["word-link", "grammar-repair", "collocation-factory", "sentence-builder", "word-graph", "reading-race", "story-choice", "listen-pick", "dictation"];
const users: { token: string }[] = [];

test.beforeAll(async ({ request }) => {
  // Two learners move across all nine activities, without registration bursts.
  for (let i = 0; i < 2; i++) {
    const registered = await request.post(`${API}/v1/auth/register`, { data: {
      email: `contract-${randomUUID()}@example.test`, password: "SunlitTest123!", displayName: "Contract Learner",
    } });
    expect(registered.ok(), await registered.text()).toBe(true);
    users.push(await registered.json());
  }
});

function responseFor(a: LearningAttempt, correct: boolean) {
  if (a.activity === "sentence-builder") {
    const texts = sentences.items.find(item => item.id === a.itemKey)!.chunks;
    const available = [...a.prompt.chunks!];
    const ordered = texts.map(text => available.splice(available.findIndex(chunk => chunk.text === text), 1)[0]);
    if (!correct) ordered.push(ordered.shift()!);
    return { answer: JSON.stringify(ordered.map(chunk => chunk.id)), actual: ordered.map(chunk => chunk.text).join(" "), reference: texts.join(" ") };
  }
  if (a.activity === "dictation") {
    const reference = dictation.items.find(item => item.id === a.itemKey)!.transcript;
    const answer = correct ? reference : reference + " extra";
    return { answer, actual: answer, reference };
  }
  if (a.activity === "story-choice") {
    const choices = story.nodes.find(node => node.id === story.start)!.choices!;
    const effective = choices.filter(choice => choice.good);
    const answer = correct ? effective[0].label : choices.find(choice => !choice.good)!.label;
    return { answer, actual: answer, reference: effective.map(choice => choice.label).join(" OR ") };
  }
  let reference: string;
  if (a.activity === "word-graph") reference = graph.nodes.find(node => node.id === graph.edges.find(edge => edge.id === a.itemKey)!.to)!.label;
  else reference = [...words.items, ...grammar.items, ...collocations.items, ...readings.items, ...listening.items].find(item => item.id === a.itemKey)!.correctAnswer;
  const answer = correct ? reference : a.prompt.options.find(option => option !== reference)!;
  return { answer, actual: answer, reference };
}

// Real API contract matrix complements each activity's browser interaction tests.
for (const activity of activities) test(`${activity} grades actual right/wrong responses and closes legacy reward access`, async ({ request }) => {
  for (const correct of [false, true]) {
    const user = users[Number(correct)];
    const headers = { Authorization: `Bearer ${user.token}` };
    const before = (await (await request.get(`${API}/v1/me`, { headers })).json()).user.xp;
    const input = { requestId: randomUUID(), activity, cefrLevel: activity === "word-graph" ? "A2" : "B1",
      pack: activity === "word-graph" ? "travel-network" : activity === "story-choice" ? "hotel-check-in" : "cefr-core" };
    const created = await request.post(`${API}/v1/learning/attempts`, { headers, data: input });
    expect(created.status(), await created.text()).toBe(201);
    const a: LearningAttempt = await created.json();
    expect(a).not.toHaveProperty("correctAnswer"); expect(a).not.toHaveProperty("result");
    expect(a.listening?.transcript).toBeUndefined();
    const path = `${API}/v1/learning/attempts/${a.attemptId}`;
    const response = responseFor(a, correct);
    const data = { answer: response.answer, contentVersion: a.contentVersion, rulesVersion: a.rulesVersion };
    if (a.listening) {
      expect((await request.post(`${path}/submit`, { headers, data })).status()).toBe(409);
      // Playback is explicitly client-reported. This verifies the journal gate,
      // not a human listener; media callbacks are covered in listening/dictation.spec.
      const event = { requestId: randomUUID(), rate: .72, status: "requested", contentVersion: a.contentVersion, rulesVersion: a.rulesVersion };
      expect((await request.post(`${path}/audio`, { headers, data: event })).ok()).toBe(true);
      expect((await request.post(`${path}/audio`, { headers, data: { ...event, status: "completed", provider: "browser-speech-synthesis" } })).ok()).toBe(true);
    }
    expect((await request.post(`${path}/submit`, { headers, data: { ...data, accuracy: 1 } })).status()).toBe(400);
    const submitted = await request.post(`${path}/submit`, { headers, data });
    expect(submitted.ok(), await submitted.text()).toBe(true);
    const result = await submitted.json();
    expect(result).toMatchObject({ correct, actualAnswer: response.actual, correctAnswer: response.reference,
      xpDelta: correct ? 20 : 0, reviewAdded: !correct, progressionApplied: true,
      evidence: activity === "listen-pick" ? "server-objective-guided-listening" : activity === "dictation" ? "server-objective-guided-dictation" : "server-objective" });
    expect(result.feedback.length).toBeGreaterThan(0);
    expect(await (await request.post(`${path}/submit`, { headers, data })).json()).toEqual(result);
    expect((await (await request.get(path, { headers })).json()).result).toEqual(result);
    expect((await request.get(path)).status()).toBe(404);
    expect((await (await request.get(`${API}/v1/me`, { headers })).json()).user.xp).toBe(before + (correct ? 20 : 0));
    if (!correct) {
      const reviews = await (await request.get(`${API}/v1/review`, { headers })).json();
      expect(reviews.items).toContainEqual(expect.objectContaining({ itemKey: a.itemKey, answer: response.reference }));
    }
    expect((await request.post(`${API}/v1/attempts`, { headers, data: {
      activity: ` ${activity.toUpperCase()} `, skill: "Vocabulary", itemKey: a.itemKey, accuracy: 1,
    } })).status()).toBe(409);
  }
});
