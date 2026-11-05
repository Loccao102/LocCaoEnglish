# ADR 020: Content Studio owner-fenced client state

Status: Accepted
Date: 2026-11-05
Roadmap: CORE-006

## Context

Content Studio is a client component, while its lesson list and mutations are
authenticated API calls. A mount-only read could leave a teacher's draft visible
after the browser changed to a learner or another account. A late response from
the previous identity could also repopulate that editor.

## Decision

Content Studio is mounted under the signed-in token. A token change discards the
old editor tree and starts a fresh owner-scoped read. Every API call captures the
token explicitly; role/list reads and mutation continuations verify that the
captured token is still the current browser token before applying state.

Save and delete operations share a pending guard, disable editor mutations while
in flight, preserve unsaved fields on failure, and show an explicit retry/error
message. Delete retains the existing user confirmation. Guest and learner views
show a permission boundary without requesting admin lesson data. No server
contract or lesson data migration is required.

Failed role/list reads seal the protected view. A network failure keeps the
current account's selected edits in memory until an explicit retry checks its
role again; a token change discards that tree. A 401/403 from a write also seals
the editor. Lost replies are unconfirmed, with an explicit list refresh rather
than a fabricated saved/deleted result. Refresh does not replace unsaved fields;
opening a saved list entry is an explicit choice. No local draft store or
cross-account draft import is introduced.

## Consequences

Account changes cannot display the previous teacher's draft in the active editor,
and stale responses cannot overwrite the new owner's state. A response that
arrives after an account change is intentionally ignored; the new owner reloads
their own role and lesson list. API authorization remains the final write/read
boundary.
