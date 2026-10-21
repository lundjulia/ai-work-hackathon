---
provenance: Unvetted Synthetic
---

# Autopilot persistence and daily review

The browser reads and mutates server-owned demo state through `/api/demo`. The server builds financial views from the connected synthetic fixtures and persisted balance adjustments. It does not import browser localStorage state. Voice uses `loadDemoState()` from `apps/web/src/lib/server/demo-store.ts`.

The demo uses a fake sign-in. Every demo API route requires the `demo_user` cookie to equal `sofie`. POST also rejects a supplied Origin from another host. This cookie is an approved demo mock, not production authentication. Responses use `Cache-Control: no-store`.

## API contract

GET returns `{state, home, accounts, suggestion, configured: {autopilot}}`.

POST accepts these JSON operations. Successful replies include the same response fields, and a completed review also includes `run` and `items`.

| operation | additional fields |
| --- | --- |
| connectBank, disconnectBank | `bankId`: danske, revolut or saxo |
| saveGoals, completeOnboarding | `goals`: existing UI Goals shape |
| advanceDays | `days`: integer from 1 to 14 |
| runAutopilot | none |
| decide | `id`, `decision`: approved or dismissed |
| reopen, markNotUseful | `id` |
| reset | none |

The request schema rejects extra fields, invalid bank IDs, nonfinite or negative financial goals, invalid calendar dates and out-of-range clock advances. The clock starts on 2026-10-19 and cannot pass the generated fixture end on 2026-11-02. Onboarding saves goals and completes even when Claude is unavailable. It returns a message explaining setup or review failure. A direct `runAutopilot` request without `ANTHROPIC_API_KEY` returns HTTP 503 with `autopilot_not_configured`. There is no runtime deterministic substitute for Claude.

## Persistence choice

`@libsql/client` uses the application's `DATABASE_URL` and `DATABASE_AUTH_TOKEN`. Initialization creates `autopilot_demo_state` if absent, with `id`, `state_json`, `revision` and `updated_at`. The single demo persona uses row ID `sofie`. The JSON includes the existing DemoState fields and an internal `goalsRevision`. Goals, connections and reset change the goal revision. A database revision changes on every saved state mutation.

This is an expedient single-persona hackathon architecture. It avoids a broad schema migration while keeping each approval and balance adjustment in one atomic SQL update. It is not the durable multi-user design. A production implementation needs real identity, normalized accounts and action records, audited decisions, and a scheduled-job ownership mechanism.

Updates use compare-and-swap SQL against the expected database revision. Ordinary mutations retry a bounded number of conflicts. Claude runs read a snapshot and only save if that revision still matches. If another request changes the clock, goals, balances or actions during a review, the review returns a recoverable conflict and writes no findings. Concurrent requests for the same date and goal revision can call Claude twice, but only one run is persisted. Repeat requests reuse the saved run.

## Claude boundary

`autopilot.ts` calls the Anthropic Messages API with `claude-sonnet-4-6`, a forced `submit_daily_review` tool, a bounded output and a request timeout. The tool selects at most three existing candidate keys in priority order and a short qualitative summary. Server validation rejects unknown or duplicate keys, numeric summary claims and omission of all high-severity candidates. Invalid or unreadable upstream responses produce a recoverable error without saving a run.

The app preserves the deterministic title, body, amount, account IDs, rationale, facts and trigger date for every selected finding. Claude does not compute or rewrite monetary amounts. The prompt is self-contained and treats fixture and user-entered text as data. A local static `tpl` helper authors the prompt because this repository has no Lexsee shared package or Nous prompt-management dependency.

Existing findings do not respawn each day. Feedback marked `not_useful` suppresses the finding family, including changed amounts or later budget months. Transfer approval or dismissal suppresses new variants between the same accounts during that month. A dismissed transfer from an older goal revision can be proposed again after revised conditions. Budget findings may move from near-limit to over-limit as separate alerts unless the user marked that budget family not useful.

## Approval safety

Approval requires a new action. A transfer additionally requires a positive finite DKK amount, distinct connected current and savings accounts, a matching goal revision, healthy nonstale balances, current available funds and a freshly computed candidate matching the original amount and account path. The source must retain the configured minimum balance. The status and both balance adjustments save together through compare-and-swap. Repeated approvals fail; approved actions cannot be reopened. These transfers update synthetic balances only.

## Checks and remaining gaps

Focused tests use isolated `verify-*` rows and remove only those rows afterward. They exercise database conflicts, retained updates, idempotent daily runs, feedback, clock changes during review, exactly-once transfers, stale recovery and invalid amounts. Test selectors are injected only by the test code; runtime calls always use Claude.

Run local checks from the repository root:

```sh
pnpm exec varlock run --path apps/web -- pnpm exec tsx --test apps/web/src/lib/server/demo-backend.test.ts
pnpm --filter web exec tsc --noEmit --incremental false
```

To exercise the same tests against an actual configured Turso database:

```sh
env DEMO_TEST_TURSO=1 pnpm exec varlock run --path apps/web -- pnpm exec tsx --test apps/web/src/lib/server/demo-backend.test.ts
```

The remote flag rejects `file:` scaffold values. The current checks used local SQLite only. No remote Turso migration or connection has been verified. The focused tests create the state table locally; the primary persona row initializes on first authenticated state read. The live Claude round trip remains unverified because the API key is absent. No public cron or deployment was added by this worker.
