# ADR 016 — Personal campaign and Journey read ownership

Date: 2026-10-25. Status: accepted for implementation; acceptance pending.
Scope: CORE-006 follow-up to ADR 014/015. No backend contract change.

## Problem

TravelCampaign, ConversationCampaign and WorkCampaign load progression once,
using an implicit token. AppShell does not remount them when authentication
changes. A's chapter clears/checkpoints can remain after switching to B or guest;
a delayed A response can populate the current page. Anonymous GET compatibility
also lets these pages present demo readiness without identifying its source.
Boss writes already enforce the signed-in owner; this is incorrect displayed
state, not evidence that a player can bypass preparation gates.

PlayerJourney's learning summary has partial adventure-ID/cleanup guards but
uses an implicit dashboard token and waits for effects to clear old learning
counts. Its story and Fair state have separate contracts and remain out of scope.

## Decision

1. Reuse `useSignedInToken` and `useAccountResource` for each personal read. The
   request captures an explicit token; rendered data is suppressed immediately
   when the captured/current identities differ. Late successes and errors from
   old identities or older refreshes cannot replace the current view.
2. Read progression only for signed-in accounts. Guests may see the existing
   static district introduction/chapter presentation and a sign-in notice, but
   no demo clear counts, personal checkpoint marks, readiness or replay actions.
   Reuse existing presentation copy; do not create another authoritative mission
   catalog. If static browsing needs a mission name, use existing display tags.
3. Provide meaningful loading, unavailable, retry and sign-in-again states. Do
   not substitute zero progress for a failed/unconfirmed read. A refresh cannot
   leave old personal action states presented as newly verified. Read requests
   may supersede one another; only the newest response is displayed.
4. Change only Journey's learning summary. Its dashboard read captures a token
   independently of asynchronous story/Fair identity updates. Clear old XP and
   due-review counts immediately on identity change. Keep village/Fair saves,
   currency, friendships, equip behavior and their existing notices intact.
5. Preserve progression/dashboard GET demo compatibility for API clients and
   all existing signed-in payloads. No profile/equipment write, migration, guest
   import, reward grant, chapter gate, XP/rank policy or provider change.

## Implementation boundaries

Format the touched campaign components for review rather than minifying new
logic. Share a small presentation/read helper only where it reduces duplicate
ownership rules; do not rewrite every world page or mutate the shared resource
hook's established default behavior. Keep existing ready-account chapter copy,
routes and preparation actions. Avoid changing notices used by accepted reward
pages unless defaults and accessible names are preserved.

## Acceptance

- Distinct A/B progress on all three mounted district pages; account switch and
  logout immediately remove A's personal status/actions before B's read resolves.
- Delay A's GET success/error, change owner, then release it; B/guest stays intact.
- Guest with demo enabled/disabled: static district information remains usable,
  and no demo personal progression/dashboard read is issued by these new paths.
- Unavailable/expired-token states have retry/sign-in recovery; retry captures
  current authentication. Reverse two refresh responses; newest read wins.
- Journey learning counts follow the current account while story/Fair state
  stays in its existing domain. Reads do not write profiles/loadouts or grant XP.
- Relevant real-browser/API regressions, readable notices at 390×551/844,
  production build/typecheck and full final-head CI. Route fixtures may prove
  delayed-response rendering; disclose those boundaries separately from actual
  backend account/auth tests. No production deployment is included.

## Recovery

No persistence format or schema changes. A frontend rollback restores the old
read behavior without removing account data. Keep the API's signed-in profile
write boundary and all existing reward/migration fixes when rolling back UI.
