---
provenance: Unvetted Synthetic
---

# Browser demo state and Claude review

The browser stores the demo state locally alongside the bundled synthetic bank fixtures. There is no application database or server-owned demo ledger. Goals, bank connections, clock advances, approvals and feedback use client-safe deterministic transitions in `lib/demo-operations.ts`. The browser store owns revision checks and cross-tab serialization. A saved snapshot is editable demo input, not trusted financial history.

`lib/demo-state-schema.ts` validates the complete snapshot before transitions and server reviews. It rejects unknown fields, invalid calendar dates, duplicate or unknown bank connections, unknown fixture account IDs, nonfinite amounts and out-of-range values. Actions and runs are capped at 100 each, evidence records at 64 fields, and strings have explicit length limits. The simulated clock starts on 2026-10-19 and cannot pass the fixture end on 2026-11-02.

## API contract

Every request requires the fake sign-in cookie `demo_user=sofie`. The shared request guard also rejects supplied foreign Origins and cross-site requests. Responses use `Cache-Control: no-store`. This cookie is an approved demo mock, not production authentication.

GET `/api/demo` returns only `{configured: {autopilot: boolean}}`.

POST `/api/demo` accepts `{snapshot: PersistedDemoState, operation: "runAutopilot"}`. The complete JSON envelope is limited to 262144 streamed bytes. Oversized requests return 413, malformed or unknown snapshot fields return 400, and a missing Claude key returns 503. The server recomputes candidates from fixtures and the supplied accepted goals and balance adjustments. It does not accept browser-computed candidate objects.

A successful POST returns `{state, home, accounts, suggestion, configured, run, items}`. The returned state is a proposal for the browser store to commit against its original local revision. If another tab changes the clock, goals or decisions during a review, the browser must reject the stale response. The server retains no snapshot between requests.

## Local operations

`applyLocalDemoOperation(state, operation)` returns a validated next state. It never performs a network request. `completeOnboarding` only saves goals and onboarding status. The client can separately ask for a Claude review. `runAutopilot` deliberately rejects in this local transition service because actual review runs belong to the stateless endpoint.

| operation | additional fields |
| --- | --- |
| connectBank, disconnectBank | `bankId`: danske, revolut or saxo |
| saveGoals, completeOnboarding | `goals`: existing UI Goals shape |
| advanceDays | `days`: integer from 1 to 14 |
| decide | `id`, `decision`: approved or dismissed |
| reopen, markNotUseful | `id` |
| reset | none |

Goals, connections and reset change the internal `goalsRevision`. Ordinary clock advances preserve it. IDs and metadata remain compatible with the existing UI and voice contracts.

## Claude boundary

`runAutopilotSnapshot(snapshot)` calls the Anthropic Messages API with `claude-haiku-5-5`, a forced `submit_daily_review` tool, a bounded output and a request timeout. Haiku 5.5 rejects the former temperature override, so the request omits it. Claude selects at most three existing candidate keys and a short qualitative summary. Unknown or duplicate keys, numeric summary claims and omission of all high-severity candidates are rejected. Invalid upstream output writes nothing. There is no deterministic runtime substitute for Claude.

The app copies each selected candidate's original computed title, body, amount, accounts, rationale, facts and trigger date. Claude never computes or rewrites monetary amounts. The self-contained prompt treats the fixture and user-entered payload as data. Its local static `tpl` helper has no Lexsee shared-package or Nous dependency.

A supplied snapshot containing a run for the same simulated date and goal revision reuses that run. Independent requests with the same earlier snapshot may both call Claude. The browser's revision commit determines which proposal is saved.

Existing findings do not respawn every day. Feedback marked `not_useful` suppresses the finding family, including changed amounts or later budget months. Transfers between the same accounts are suppressed during the review month. A dismissed transfer from an older goal revision can be proposed again. Budget findings may move from near-limit to over-limit as separate alerts unless that budget family was marked not useful.

## Approval behavior

Approval requires a new action. Transfers additionally need a matching review record, immutable computed evidence, a positive finite DKK amount, distinct connected current and savings accounts, the current goal revision and a freshly computed candidate matching the original amount and path. Both accounts must be healthy, source balances must be nonstale, and the source must retain the configured minimum balance.

The local transition returns the status and both synthetic balance adjustments together. Duplicate approval rejects, and approved actions cannot be reopened. The browser store must serialize and commit this transition atomically. A user can edit local storage, so this is a controlled demo workflow rather than tamper-proof accounting. No real payments occur.

## Verification

Run the focused checks from the repository root:

```sh
pnpm exec tsx --test apps/web/src/lib/server/demo-backend.test.ts
pnpm --filter web exec tsc --noEmit --incremental false
```

The focused suite exercises client onboarding, clock bounds, bounded snapshot schemas, streamed body limits, stateless idempotency, immutable AI action output, unknown selections, duplicate approval, stale-goal recovery, altered transfer evidence and feedback. Selectors are injected only in tests; runtime uses Claude. Browser concurrency and cross-tab notifications belong to the browser store checks.

The backend no longer creates SQL tables, loads server state, or requires database credentials. The stateless live Claude round trip is a main-thread integration check; the focused suite uses injected selectors. This worker added no deployment or public cron.

## Main integration evidence

On 2026-10-21, the configured account model list confirmed `claude-haiku-5-5`. Its initial request rejected the legacy temperature option with HTTP 400. The request regression failed before omitting that option and passed after the change. All 12 backend tests passed. A real browser daily review then returned and persisted three computed actions, visible on Home and Actions. Final production build passed. Main restored the original browser baseline at revision 9. This verifies the bank daily-review path, not the planned receipt workflow or live Azure voice.
