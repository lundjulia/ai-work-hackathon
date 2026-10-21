---
provenance: Unvetted Synthetic
---

# Current seams and work tracks

The target combines family receipt budgeting with banks, investments, mortgage and loan insights. Azure OpenAI voice is the primary interface; tools display category-aware budget, goal, forecast and loan artifacts. Claude Haiku 5.5 is the main LLM for daily review and intended receipt categorization. Azure gpt-live-1 handles audio; gpt-6-luna is an optional helper if needed, with no helper integration configured. The table distinguishes current behavior from requested additions.

## What runs, what is simulated, what is missing

| Part | Current behavior | Status or limit |
| --- | --- | --- |
| Sign-in | A labelled demo flow sets the fixed persona cookie | Approved simulation, not household authentication |
| Banks | Consent UI saves connected bank IDs locally. Fixture connectors return synthetic accounts, balances, transactions and holdings | Approved simulation. No Open Banking network call or bank token |
| Time advance | Reveals authored future transactions through the selected simulated date | No live bank polling. Activity ends 2026-11-02 |
| Finance | Shared code computes spending, forecasts, goals, risk and financing findings | Real calculations on synthetic data. Quotes, FX and tax assumptions are illustrative |
| State | Bundled defaults initialize a versioned localStorage record. Edits increment its revision | Same-origin tabs share it. Separate browsers/devices do not |
| Daily review | Client POSTs a bounded snapshot; Claude selects recomputed candidates and a qualitative summary. Browser commits only at the starting revision | Real Haiku 5.5 browser daily review passed with three persisted computed actions |
| Approvals | Local operation validates current proposal evidence and records simulated account adjustments | No real money moves. Browser input is editable demo data, not a trusted ledger |
| Voice | GPT-Live backend SDP broker; client delegation calls Haiku with fresh browser state and renders typed artifacts | User confirmed audible reply and matching grocery card on localhost3001. Earlier 401 was inherited environment override plus the wrong Realtime API, both corrected |
| Receipts/Nexi | Planned synthetic connection and receipt arrival, with real Claude item classification | No importer, line-item state, allocation or categorization workflow yet. Live Nexi API availability unverified |
| Avatar and artifacts | Penny is Home. Conversational onboarding proposes a complete plan; typed budget, goal, forecast, action and settings cards render computed values | Real browser settings save and notification budget artifact passed. No standalone Talk entry point; text chat uses Haiku |
| Mortgages/loans | Calculators use fixed sample liabilities and synthetic quotes | Editable household inputs missing. Current view shows liabilities only when Danske is connected; user-entered liabilities should be independent |
| Notifications | Demo controls add receipt, budget, review or goal events to a persisted in-app stack. Opening a notification activates contextual Penny conversation | Real browser budget notification path passed. Receipt event remains a labelled sample without allocation or budget changes. No closed-browser schedule or push sender |

## Separate family app now present

Another thread has committed `apps/penny`, a separate Next.js app on port 3002 with its own Zustand/localStorage store. Its owner reports a synthetic receipt, avatar, goals, notification screen and offers demo. Those parts are not connected to `apps/web` or its shared bank state, revision checks and Azure voice. Reuse and integration should precede another implementation of the same screens.

Penny's current categorization has a deterministic fallback, category-level totals use a receipt's dominant category, and receipt reactions can increase `goal.saved` from projected surplus. Those semantics differ from this thread's agreed real-AI failure handling, mixed-payment allocations and distinction between projected savings and contributions. Its advisor also uses `claude-opus-5-5`; reconcile it with the new Haiku-main decision before treating the two apps as one candidate. [Penny requirements](penny-prd.md) and its status row carry its owner's evidence, which this thread has not independently rehearsed.

## How the fake bank works

`Connector` in `packages/finance/src/types.ts` defines account, balance, transaction and holding reads. `DanskeBankFixtureConnector`, `RevolutFixtureConnector` and `SaxoFixtureConnector` in `connectors/fixture.ts` implement it. Seeded activity lives in `fixtures/generate.ts`, with persona/account definitions in `fixtures/persona.ts`.

`connectBank` saves a bank ID. `buildFinanceView(state)` calls `loadDemoDataset(state.simulatedDate)` and filters it to those connected providers. Opening balances plus booked flows produce balances; pending flows affect available cash. Date advance exposes future fixture records. Internal transfers, pending/booked duplicates and investment cash are handled by the finance calculations, so they do not inflate totals.

A future live provider would implement the connector contract, but live consent/token handling and refreshed-data storage do not exist. Expired-consent and outage fixture scenarios exist at package level; the app currently loads the healthy scenario.

## Stable integration contracts

| Seam | Contract and owning files | Caller responsibility |
| --- | --- | --- |
| Browser storage | `getLocalDemoStore().read()`, `mutate(update)`, `compareAndSwap(revision,state)` in `lib/local-demo-store.ts` | Use the shared store. Avoid independent localStorage writers |
| Record | `{storageVersion:1,state:PersistedDemoState,revision,writerId}` | Storage version and state schema are separate. Adding receipt/household state needs an explicit migration of existing records |
| Snapshot | `PersistedDemoState`, `persistedDemoStateSchema`, `DEMO_SNAPSHOT_MAX_BYTES=262144` in `lib/demo-state-schema.ts` | Bounded schema-valid editable input. New state must fit the same transport bound or coordinate a deliberate change |
| Local operations | `applyLocalDemoOperation(snapshot, operation)` and `demo-operation-schema.ts` | Deterministic edits run locally through the store. AI/network work must not hold its lock |
| UI data | `buildFinanceView(state)` and `components/app-state.tsx` | Reuse shared calculations for screens and tool results |
| Tab updates | `publishStateChange` and `subscribeToStateChanges` | Invalidation signals cause local rereads. BroadcastChannel plus storage events, no SSE |
| Daily AI | `POST /api/demo` with `{snapshot,operation:"runAutopilot"}` | Commit returned state with compare-and-swap at the original revision; discard stale output and retry |
| Voice | Session POST `{snapshot}`; tool POST `{snapshot,name,arguments}` | Read current local state on every tool invocation. Azure server credentials never enter browser snapshots |
| HTTP guards | `checkDemoRequest` and `readBoundedJson` in `lib/server/demo-http.ts` | Reuse cookie, Origin, JSON and streamed-body checks for new AI routes |

Components reports 23 focused tests and real two-tab/reload/storage-event verification. Web Locks serialize supported secure-browser writes. The fallback rereads and checks revisions with retries, but localStorage has no true cross-process transaction. Storage clearing loses demo edits. Browser-local state enables open-app review; unattended daily review and cross-device sync need an additional design.

## Independent work tracks

| Work track | Concrete outcome | Files and coordination |
| --- | --- | --- |
| Receipt processing and allocations | Labelled Nexi demo connection; bundled receipt fixtures; recoverable Claude line classification; editable categories; one linked payment split across budgets without double-counting | Reuse the Penny fixtures/UI where suitable; own the shared receipt model/workflow. Coordinate one schema/store migration and `finance-view` changes with main. Receipt IDs/fingerprints need event deduplication beyond daily date/goalsRevision |
| Voice artifacts and avatar | Reuse Penny avatar/UI where suitable; voice-led main screen; `show_budget({category,period})`, goal/forecast/loan artifacts; transcript and typed input; spoken facts match the displayed artifact | Reuse existing WebRTC hook. Agree artifact schema and callbacks with voice owner before shared hook edits. Include call ID and local revision; reject or refresh stale results |
| Household inputs and comparisons | Editable property, mortgage and car-loan terms; calculated scenario comparison with explicit quote/tax assumptions | Own editor and liability validation. Coordinate shared state migration and finance adapter; do not tie user-entered liabilities to a bank flag |
| Demo and QA | Combined receipt-to-budget-to-goal conversation, bank/loan continuation, phone audio check, recoverable AI failure and stale-result check, updated pitch | Main owns candidate builds and paid rehearsals. Presentation changes must match demonstrated behavior |

GPT-Live protocol and environment override fixes are integrated; user verified local audio and a matching budget card. Full spoken onboarding, phone and sustained recovery QA remain. General persistence, cross-tab subscriptions and HTTP guards are complete handoffs; new threads should reuse them. Meal planning and supermarket offers remain an open scope decision.

Goal displays also need a precise meaning. The current `saved` value is cash above the safety-net target, not a contribution ledger. Planned artifacts must distinguish available surplus, projected savings and recorded contributions.
