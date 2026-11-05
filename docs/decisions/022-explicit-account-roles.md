# ADR 022 — Assign privileged roles to verified account IDs

Date: 2026-11-05. Roadmap: SEC-002. Replaces email bootstrap behavior.

## Problem

Public registration accepts an email without proving ownership. Previously,
`RoleForUser` could promote that account from `ADMIN_EMAILS` or `TEACHER_EMAILS`.
An unregistered address in either list could therefore be claimed to gain a
privileged role. A unique email constraint does not prove ownership. The same
bootstrap could undo an operator's explicit demotion.

## Decision

Roles come only from stored assignments keyed by the existing user ID. Missing
assignments default to learner. Legacy email environment variables have no effect
and are removed from both Compose configurations and the example environment.
PostgreSQL inserts a missing learner row without overwriting an existing row,
then reads the stored result; a concurrent operator assignment is preserved.
Memory mode follows the same role semantics but remains temporary.

There is no public role-management endpoint. The API image includes `/roles`, an
operator command requiring `DATABASE_URL`, an exact existing `--user-id`, and
`--role learner|teacher|admin`. It uses the existing validated `SetUserRole`
operation. A missing/invalid account, invalid role, missing database configuration
or failed database write exits unsuccessfully. Error messages omit database
credentials and driver details. The command uses normal store startup, including
existing schema/bootstrap checks; run it only against the intended initialized
environment, after the matching API release is ready.

An operator verifies the intended person and account independently before using
the ID. An email string by itself is not sufficient verification. Do not share
the command/database credentials with ordinary application users. No new grants,
database credentials, HTTP bootstrap secret or provider integration is added.

## Operator procedure

1. Confirm the intended environment, trusted operator access and matching API
   image. Keep the normal database backup/restore procedure.
2. Independently confirm the account owner and its exact existing user ID. The
   account can read its ID through authenticated `GET /v1/me`; do not collect its
   password or token in repository issues, logs or commits.
3. In that environment's API container run `/roles --user-id ACCOUNT_ID --role
   teacher` (or admin/learner). For the production Compose file the complete
   invocation is:

   ```sh
   docker compose -f docker-compose.prod.yml exec -T api /roles --user-id ACCOUNT_ID --role teacher
   ```

4. Check the command's successful confirmation and the account's next `/v1/me`.
   Authorization looks up the stored role on each protected request. Use role
   learner to revoke privileges, then confirm protected endpoints return 403.

This is an operator runbook, not a deployment performed by this task. Repeating
the same account/role assignment is safe after a lost confirmation. Conflicting
operator assignments are deliberate last-write-wins changes; verify the final
role. The command does not accept email selectors or create a new account.

## Compatibility and rollout

The existing `user_roles` schema and auth/API response shapes are unchanged.
Existing role rows are retained, including previously bootstrapped rows; there is
no inferred ownership backfill or automatic bulk revocation. Before production,
an operator must review existing teacher/admin rows against independently
confirmed accounts and explicitly demote unconfirmed assignments. Historical
rows do not record whether email bootstrap or an operator created them, so the
code cannot safely infer that decision.

An account that depended on an email variable but has no stored role now remains
learner until an operator grants its verified ID. Remove the obsolete variables
from deployment configuration. Do not restore email bootstrap as a recovery
step. Account passwords, XP, saved attempts, reviews, course bookmarks and
learning evidence are not migrated or deleted by the role change.

## Verification

Regression tests cover memory/PostgreSQL role lookup, explicit grants, demotion,
restart, invalid identities/roles and first-read concurrency. HTTP tests register
an address present in both obsolete environment variables and require learner
plus denied teacher access. CLI tests check exact account assignment, invocation
validation, cleanup and sanitized failures.

The full CI stack registers its own dedicated example.test teacher, invokes
`/roles` with the returned ID, verifies `/v1/me`, then runs the existing real
teacher analytics E2E through login. The fixture helper refuses non-CI or a
non-loopback target and does not print credentials. The stack/database are
disposable; no user's account is granted, revoked or reset. All runtime checks
run on GitHub Actions; this task does not execute the app/tests locally.
