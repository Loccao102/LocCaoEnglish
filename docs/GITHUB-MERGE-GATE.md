# GitHub merge gate

Roadmap: GOV-002. Applied and verified 2026-11-05 as active repository ruleset
[26589636](https://github.com/Loccao102/LocCaoEnglish/rules/26589636).
The [JSON request template](proposals/main-required-ci.json) remains inert in
the repository; the administrative REST request applied the policy, not the
file's commit. ROADMAP remains the only source of task status.

## Observed baseline

On 2026-11-05, main `7805b50` was `protected:false`, its required checks were
off and repository rulesets were empty. These are read results, not proof of
write permission. The GitHub connector exposes ruleset/protection reads but no
administration mutation. A read-only browser inspection reached the settings
and new-rule form; no rule was submitted and administration write permission
was not established by that inspection. Existing GitHub CLI authentication later
confirmed administration permission and applied the reviewed request through
the REST API. No new credential, app grant or browser setting was created.

The actual check runs on head `3230a73` have exactly these names, all from the
GitHub Actions app ID 15368: `frontend`, `backend`, `ai-service`, `compose`,
`integration`, `e2e`. Recheck names and app identity before changing this policy.

## Applied policy

| Setting | Policy | Reason |
| --- | --- | --- |
| Target/enforcement | main only, active | Protect the integration branch |
| Pull request | Required | Keep the change reviewable before integration |
| Status checks | All six named checks, bound to Actions app | Require the actual project gate |
| Force pushes/deletion | Block both | Preserve accepted history and branch |
| Bypass actors | None | No account/app exemption |
| Review approvals | Zero mandatory approvals | No independent reviewer has been assigned; do not invent one or lock out a sole maintainer |
| Review conversations | Resolve all | Preserve actionable review feedback |
| Latest-base requirement | Off | Keep stacked PRs usable; still inspect merged source conflicts and validate the actual combination |
| Linear history | No rule | Existing integration preserves feature ancestry with merge commits |

Zero required approvals does not mean human review occurred. Architecture,
data ownership, semantics, license and visual quality still require source or
human review appropriate to the change. Green checks alone do not complete those
requirements. No people, teams, CODEOWNERS, secrets or app grants are added.

## Application and read-back

An authorized administrator needs a supported administration interface and a
repository plan that can enforce these rules. Review the exact JSON first and
compare existing rules again; do not overwrite a policy added by someone else.
If the interface cannot express an option or the API rejects a field, stop and
reconcile the proposal with the current GitHub schema rather than silently
dropping a protection.

The request schema and permissions are documented in the official
[GitHub repository rules API](https://docs.github.com/en/rest/repos/rules#create-a-repository-ruleset).
The request uses the pull-request/status-check parameters and exact observed
contexts. Read-back confirmed active main rules, all six app-bound checks,
empty bypass actors and protected branch metadata. The current connection's
`current_user_can_bypass` value was `never`.

After applying, save the returned rule ID and read back:

- The repository ruleset, verifying active state, main target, empty bypass list,
  PR/review settings, both history protections, six contexts and app IDs.
- Effective [rules for main](https://api.github.com/repos/Loccao102/LocCaoEnglish/rules/branches/main)
  as well as [branch metadata](https://api.github.com/repos/Loccao102/LocCaoEnglish/branches/main).
  A saved form or a JSON file is not proof that rules apply to the branch.
- Repository/organization inherited rules and available merge methods. Preserve
  a stricter existing policy rather than assuming this proposal is the only rule.

## Required negative proof

Executed on [probe PR #43](https://github.com/Loccao102/LocCaoEnglish/pull/43),
head `20ffcd69048332c88eef2dbc26299b7a399d1903`:

- [CI 212](https://github.com/Loccao102/LocCaoEnglish/actions/runs/41973468716)
  failed only the deliberate new game test; all 50 existing game tests passed.
  Backend, AI, compose and integration passed; E2E skipped after frontend failure.
- Code was conflict-free but GitHub reported `mergeable_state: blocked`.
  The ordinary connected GitHub REST merge, guarded by that head, returned
  **HTTP 405**, `Repository rule violations found`, and
  `Required status check "frontend" is failing.` No bypass was requested.
- Main stayed `7805b50b5ae99aad020bf7d2039e878e9b32545a` before and after.
  The probe was closed without merging; its branch/test/check history is retained.
  Force-push/deletion protections were read back, not tested destructively.

The following procedure is retained for future policy changes:

Only after read-back confirms enforcement, open a clearly labelled disposable
probe PR against main from the current accepted runtime. Add a separate test-only
file that deliberately fails the required `frontend` check. Do not alter,
remove or weaken production tests, and do not submit player data to the probe.

Record the failed check and attempt an ordinary merge with that PR's exact head
SHA using the same non-bypass path used for real PRs. The merge must be refused;
capture the refusal and verify main did not move. Do not use an admin bypass,
force push, forged success status or an alternate base to make the proof pass.
If ordinary merge is allowed, the policy is not accepted; inspect actor/rule
configuration before proceeding. Never intentionally merge the failing probe.

Close the probe PR while preserving its failed check and refusal evidence.
Record rule ID, settings, actor privilege context, PR/head/check URLs, refusal
and unchanged-main SHA in SYSTEM-VALIDATION. Only then consider GOV-002's
acceptance criteria. Editing an incorrect rule requires another reviewed change;
do not introduce a permanent bypass as a routine recovery technique.
