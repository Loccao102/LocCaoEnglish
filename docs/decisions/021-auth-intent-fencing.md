# ADR 021 — Commit authentication only for the current intent

Date: 2026-11-05. Roadmap: CORE-006. No server API/schema change.

## Problem

The active AuthPanel called login/register helpers that stored a returned token
before the UI could check whether the user had since chosen guest, left the page
or selected a different account. A late response could overwrite a newer intent.
The account page also maintained a separate boolean that did not follow external
authentication changes.

## Decision

The active form uses a request-only authentication helper. It validates the
response shape but neither stores tokens nor dispatches authentication events.
The form captures a generation and existing token at submission. Only a mounted
form with that same generation and token may commit the response with the existing
setAuthToken function. A synchronous pending reference rejects duplicate submits.
Credentials and mode controls are disabled while a request is current.

Guest selection invalidates the generation before clearing authentication.
Authentication/storage events and unmount also invalidate pending work. Identity
verification reads use the captured token and discard old responses. Password
fields clear after an attempt or identity change; no credentials or pending auth
payload are journaled. Storage failure does not claim successful sign-in.

The account page uses the shared token subscription and keys its profile subtree
by token. This follows the existing account boundary rather than maintaining an
independent signed-in flag. Guest and account learning data are not imported.

## Compatibility and limits

Login/register endpoints, password policy, token lifetime and server responses
are unchanged. This fences the active UI, not server account creation: cancelling
a registration after it was sent may still create that account. Ignoring the
response does not delete the account or revoke an issued token. A later sign-in
can recover it. Other sessions remain subject to the existing token policy.

No production authentication, account deletion or secret change is performed by
development tests. Synthetic race fixtures are separate from a genuine dedicated
CI registration/sign-out/login/reload case. Existing user data is untouched.

## Verification

Browser cases cover late login/register after choosing guest, duplicate pending
submit, a different account selected through a storage event, navigation/unmount,
failed/invalid responses, blocked token storage and the real account flow.
Run only through GitHub Actions per user instruction. Final-head checks are
recorded in SYSTEM-VALIDATION; no local execution or production deployment.
