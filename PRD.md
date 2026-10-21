---
provenance: Unvetted Synthetic
---

# PRD: Penny

Working title; product name open. Status and owners: [status.md](status.md).

The primary interface is an AI voice conversation. The assistant calls tools to display typed budget, goal, forecast and loan artifacts alongside its explanation. Budget categories are configurable. Home is the voice assistant with relevant cards shown through tool calls. Onboarding gathers income, budgets, risk comfort, a buffer and a savings goal conversationally, then saves a confirmed summary into the shared browser state. There is no separate Talk entry point or form-led goal setup. Current implementation and work ownership: [seam map](docs/seams.md).

Scope reviewed against [Problem + Idea](https://docs.google.com/document/d/1c3nieExbHYsZclCYt0nbJxO-dADehgvwg7vWb-QFu2M/edit), modified 2026-10-21 18:35 Copenhagen. The developer confirmed keeping both the family receipt-budget demo and the original bank/mortgage features. Review and implementation plan: [combined scope review](docs/scope-review.md).

## Problem and promise

Keeping on top of personal finances across several banks takes daily attention most people do not give it. Penny connects all of your banks and investments, learns your finances, and runs an agent every day. It only contacts you when there is something to act on. **You don't need to open the app day to day. Go live your life.**

## User

A fictional Danish family with children. Sofie is the parent managing an everyday account at Danske Bank, card and FX spending on Revolut, investments at Saxo, and a Danish mortgage. They want calm control over food and broader household spending, less money stress, and progress toward a chosen savings goal.

## Features

| # | Feature | Demo role |
| - | ------- | --------- |
| F1 | **Sign-in and onboarding**: account creation, connecting banks through an Open Banking consent flow (Danske Bank, Revolut, Saxo) | Opens the demo |
| F2 | **Goals**: risk tolerance, income, budgets, safety net, savings goal. The agent proposes values from the imported data (auto-budget), and the user adjusts them | Core |
| F3 | **Unified overview**: cash plus investments across banks, spending by category, recurring payments, cash-flow forecast | Core |
| F4 | **Daily autopilot run**: the agent reviews new data against the goals and produces action items (budget alerts, insights on transactions, money routing such as "move surplus to savings", risk checks) | Core, the aha moment |
| F5 | **Notifications and action items**: a push/in-app notification leads to approve, dismiss, or ask-why. User feedback tunes future runs | Core |
| F6 | **Voice-first assistant**: Azure OpenAI realtime voice with typed visual artifacts from tool calls, using the same local data and deterministic calculations as the app | Primary interface |
| F7 | **Advanced insights**: Danish mortgage refinancing (omlægning) and consumer-loan consolidation, with tax effects (rentefradrag) | Showcase, stretch |
| F8 | **Risk management**: concentration and drawdown on the Saxo portfolio against risk tolerance; safety-net coverage in months | Stretch |
| F9 | **Nexi Smart Receipt demo**: labelled simulated connection, incoming synthetic receipt JSON with item prices and quantities, AI categorization and food-budget update | Core family demo |
| F10 | **Family avatar and encouragement**: openly AI character, positive tips, simulated notification screen, progress toward the family goal | Core family demo |
| F11 | **Editable financial commitments**: homes, mortgages, car loans and rates, with explained scenario comparisons | Retained broader scope |

## Combined demo path

1. Demo sign-in and labelled simulated Nexi/bank connections.
2. Penny asks about income, spending budgets, comfort with risk, a buffer for surprises and a savings goal. The parent answers by voice, reviews the summary card and confirms saving it. Later agents read those same persisted settings.
3. Home is Penny's conversation. Charts, amounts and decision cards appear when tools return relevant computed facts. A text chat is available when speaking is inconvenient or Azure audio is unavailable.
4. Demo controls trigger an event and add an in-app notification. The notification stack shows receipt, budget, money-check and goal updates. Opening one activates Penny with that event's context.
5. Penny explains the update in normal language and shows the relevant artifact. The user can ask why, adjust settings or confirm a simulated action. Decisions persist and subsequent tool calls read them.
6. The combined receipt pipeline will classify Nexi line items and allocate a linked bank payment exactly once. Until integrated, the receipt notification is an explicitly simulated example and does not change budgets or balances.

Receipt projections and actual savings contributions remain distinct. Bank/mortgage features stay available through the shared tools and supporting details.

## Decisions

- Bank connections are **mocked** for the demo (developer decision), shaped like the documented APIs. The UI labels them "Demo connection", and the pitch says that the data is synthetic and that the app calculates the results. See [demo data availability](docs/demo-data-availability.md) for the fixture and its edge cases.
- Voice uses Azure GPT-Live with a backend SDP offer/answer exchange. GPT-Live does not support ephemeral client keys. Confirmed endpoint is `https://j-hckthn-impact-resource.openai.azure.com/openai/v1`, deployment `gpt-live-1`. Azure has replaced the original direct OpenAI transport; the deployed model and live microphone roundtrip still need verification.
- Voice conversation is the main interface. Tools return computed facts plus matching typed React artifacts. Use `show_budget({category, period})`, with an omitted category showing all budgets, rather than a food-only tool. Proposed presentation tools also cover goal progress, cash forecast and loan comparison. The voice-first integration adds these typed artifacts and explicit confirmation cards; runtime verification is recorded in status.
- Nexi connection/receipt arrival and the notification screen are explicitly simulated in the updated document. Live Nexi consumer receipt API availability remains unverified. Receipt categorization is intended AI behavior; arithmetic and budget totals remain deterministic.
- The developer confirmed retaining both scopes, rather than replacing bank and mortgage features with the family demo.

- **Platform:** a Next.js **PWA** on Vercel ([scaffold guide](.agents/skills/hackathon/references/scaffold.md)). It is mobile-first and installable on the phone's home screen. The requested demo notification screen is simulated. Real web push and unattended daily runs remain product requirements with an unresolved design under browser-local storage.
- **Sign-in:** a **fake sign-in screen** that logs in as the seeded demo persona. This is an approved mock; label it in the pitch (developer decision).
- **Main LLM:** Claude Haiku 5.5, API ID `claude-haiku-5-5`, for daily review and intended receipt classification. Azure `gpt-live-1` handles realtime voice; `gpt-6-luna` is an optional helper if needed, rather than the default agent. Its Azure deployment/access is not configured. Deterministic code computes every amount; the LLM explains and prioritizes computed findings.

## Storage and execution decisions

- **Data storage:** browser storage with bundled synthetic fixtures, per confirmed developer decision. Editable demo state persists on this browser. No database is required. Local revisions and short Web Locks protect simulated decisions; BroadcastChannel/storage events notify other tabs on the same origin. AI routes validate a supplied snapshot and return proposals; the browser rejects results if its revision changed during the request. Keys remain server-only. Components verified two tabs, reload and the storage-event fallback. Without Web Locks, revision checks and retries cannot guarantee atomic writes across processes.
- **Simulated clock:** a demo control advances "today" and triggers the daily review while the app is open. Browser-local state cannot support a server cron reviewing that state while the app is closed or cross-device sync. Any future background schedule requires an explicitly chosen additional design.
- **Money movement:** read-only plus *proposed* transfers. Approving one records the decision and updates fixture balances. No payment initiation (PIS).

## Shared interfaces (to agree early)

1. **Normalized data model**: accounts, balances, transactions (source, source account ID, original amount and currency, status, dates, optional merchant/counterparty, retrieval time), holdings, liabilities (mortgage entered by the user), and goals.
2. **Connector interface**: `listAccounts / getBalances / getTransactions / getHoldings` per bank. The fixture implementation sits behind the same interface a real provider (Enable Banking, Saxo OpenAPI) would use.
3. **Insights API**: deterministic functions such as categorize, recurring, budget status, forecast, safety-net months, surplus, and refinancing calc. Both the autopilot agent and voice tools call them.
4. **Action item**: `{id, runId, type, title, body, amount?, accounts?, severity, status: new|approved|dismissed, rationale, createdAt}`.

## Out of scope

Real bank credentials or live connections (unless time allows a recorded Enable Banking pull), real payments, regulatory advice claims, multiple signed-in household members, native mobile apps, real authentication, full tax returns.

## Open questions

| Question | Proposed answer |
| -------- | --------------- |
| Deadline (timezone), submission format, demo length, live or recorded, judging criteria | Intro transcript is available in docs/intro.md. It suggests presentations around 19:45 Copenhagen and a 30-day impact plan; exact deadline and submission still need confirmation |
| Product name | Penny is the product name |
| Mortgage/loan data source | User-entered sample liability during onboarding, labelled as such (open banking does not provide it) |
| Refinancing and tax rules | Simplified calculator with stated assumptions (current bond price/rate, fees, rentefradrag rate), verified by a research worker before the pitch |
