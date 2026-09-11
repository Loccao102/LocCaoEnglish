# API surface

Base development URL: `http://localhost:8080`

Requests without `Authorization` use the seeded demo learner. Registered users send `Authorization: Bearer <token>`.

## Auth

- `POST /v1/auth/register`
- `POST /v1/auth/login`

## Learner state

- `GET /v1/dashboard`
- `GET /v1/skills`
- `GET /v1/plan/today`
- `POST /v1/attempts`

Attempt payload:

```json
{
  "skill": "Vocabulary",
  "activity": "word-link",
  "itemKey": "word-link:significant",
  "prompt": "significant — choose the closest synonym",
  "answer": "substantial",
  "accuracy": 1,
  "durationSec": 8
}
```

## Review

- `GET /v1/review?limit=30`
- `POST /v1/review/{itemKey}` with `{ "quality": 0..5 }`

## AI proxy

- `POST /v1/ai/writing-score`
- `POST /v1/ai/speaking-feedback`
- `POST /v1/ai/exercises`
- `POST /v1/conversation/reply`

## Missions

- `GET /v1/missions/airport`
