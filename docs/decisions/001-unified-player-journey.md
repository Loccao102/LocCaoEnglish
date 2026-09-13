# One journey, separate sources of progress

Status: accepted for implementation, 2026-09-13.

## Context

Sunlit Village has a playable 3D adventure, 24 original companions, 8 fair games and a learning platform. The fair initially wrote to one device-only scrapbook. Account progress, guest progress and learning evidence need to remain distinct while the player sees one coherent journey.

## Decision

- `/journey` brings together 7 story chapters, 14 quests, fair memories, companion selection and learning recommendations.
- All 24 companions belong to a chapter and a fair circle. Three visible milestones derive friendship hearts from chapter and fair saves. No independent friendship balance can drift from these sources.
- Next.js and Go consume the same fair catalog. Go calculates personal best scores from the game's round count and the reported remaining hearts.
- Fair completions carry a UUID per run. A PostgreSQL transaction locks the account summary and checks a completion ledger before changing visits or best scores. An identical retry returns the existing save; a changed payload for the same run is rejected.
- Fair results are personal keepsakes reported by the client. They grant no XP, currency, learning evidence or leaderboard points. The existing adventure grades answers on the server and awards first-clear XP once.
- A browser queue uses a separate storage key for each run and account. A failed upload can be retried after navigation, reconnection or reload. A previously verified account can use its cached scrapbook offline. An expired session requires sign-in to sync. New accounts must connect once before playing under that identity.
- Guest runs have their own local journal and preserve the original scrapbook as a baseline. Signing in does not silently merge guest records into an account.
- Same-tab authentication events and cross-tab storage events refresh identity. Captured credentials and identity checks prevent a queued run being submitted as a different account.

## Alternatives and tradeoffs

One shared XP balance for every activity would make rewards simpler to display, but would allow an unverified fair completion to inflate learning and competitive progress. A separate service for the fair would introduce deployments and synchronization work without helping this application. Browser-only saves cannot meet the cross-device account requirement.

The existing Go modular backend remains the persistence boundary. PostgreSQL is the durable mode; explicit memory mode is for temporary development. Deleting browser data removes unsynced runs, so the interface distinguishes waiting memories from confirmed account saves. This is not an anti-cheat system; competitive fair play would require server-owned sessions or action replay before granting ranked rewards.

## Delivery

Migration `011_friendship_fair.sql` is applied by `EnsureFair` at startup. `npm run dev:stack` starts the frontend, API and local AI service after PostgreSQL and Redis are available. Implement the complete flow first, then run game, backend, AI and browser tests and resolve failures before the delivery report.
