# LocCao English

A game-first English learning platform built around an adaptive skill graph. Instead of moving through fixed lessons, learners play short games, reveal weak skills, and receive a personalized practice route.

## MVP included

- Learning dashboard and learning fingerprint
- Interactive-looking Travel skill graph
- Daily quests, XP, streak and level loop
- Word Link vocabulary mini-game
- Dictation trainer using browser text-to-speech
- Speaking shadowing prototype using Web Speech APIs when available
- IELTS Writing practice with rubric-oriented local feedback
- Responsive desktop/mobile UI

## Stack

- Next.js 16.3.4
- React 19.3
- TypeScript
- Plain CSS for a low-dependency first version

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Product direction

The next architecture layer will separate the learning engine from individual game renderers:

```text
Learning content -> Exercise generator -> Game renderer -> Attempt events
                                            |
                                            v
                                    User skill fingerprint
                                            |
                                            v
                                    Adaptive next activity
```

Planned services: Go API, PostgreSQL, Redis, object storage, AI orchestration, STT/TTS and an IELTS scoring service.

> IELTS scores in the MVP are estimates for practice UX only and are not official IELTS results.
