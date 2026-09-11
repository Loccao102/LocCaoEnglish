export type LearningSkill = {
  name: string;
  level: number;
  confidence: number;
  tone: "strong" | "medium" | "weak";
};

export const skills: LearningSkill[] = [
  { name: "Vocabulary", level: 18, confidence: 82, tone: "strong" },
  { name: "Grammar", level: 13, confidence: 61, tone: "medium" },
  { name: "Listening", level: 15, confidence: 74, tone: "strong" },
  { name: "Speaking", level: 9, confidence: 48, tone: "weak" },
  { name: "Reading", level: 16, confidence: 78, tone: "strong" },
  { name: "Writing", level: 8, confidence: 44, tone: "weak" },
];

export const dailyQuests = [
  { label: "Learn 10 travel words", done: true, xp: 20 },
  { label: "Complete 5 dictation lines", done: true, xp: 25 },
  { label: "Shadow 3 speaking prompts", done: false, xp: 30 },
  { label: "Play one Word Link round", done: false, xp: 20 },
  { label: "Review 12 weak words", done: false, xp: 25 },
];

export const games = [
  { slug: "word-link", icon: "◎", name: "Word Link", description: "Connect meaning, synonym, antonym and collocation.", skill: "Vocabulary", minutes: 5 },
  { slug: "dictation", icon: "⌨", name: "Dictation Rush", description: "Listen, type, compare and collect weak words.", skill: "Listening", minutes: 7 },
  { slug: "speaking", icon: "◉", name: "Shadow Me", description: "Listen, repeat and compare your transcript.", skill: "Speaking", minutes: 6 },
  { slug: "ielts", icon: "✦", name: "IELTS Lab", description: "Practice writing with rubric-oriented feedback.", skill: "Writing", minutes: 12 },
];
