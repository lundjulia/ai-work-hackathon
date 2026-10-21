---
provenance: Unvetted Synthetic
---

# PRD: Money on autopilot

Working title; product name open. Status and owners: [status.md](status.md).

## Problem and promise

Keeping on top of personal finances across several banks takes daily attention most people do not give it. Money on autopilot connects all of your banks and investments, learns your finances, and runs an agent every day. It only contacts you when there is something to act on. **You don't need to open the app day to day. Go live your life.**

## User

A fictional Danish adult (demo persona) with an everyday account at Danske Bank, card and FX spending on Revolut, investments at Saxo, and a Danish mortgage (realkreditlån). They want a safety net, a savings goal, and spending under control, without having to track it themselves.

## Features

| # | Feature | Demo role |
| - | ------- | --------- |
| F1 | **Sign-in and onboarding**: account creation, connecting banks through an Open Banking consent flow (Danske Bank, Revolut, Saxo) | Opens the demo |
| F2 | **Goals**: risk tolerance, income, budgets, safety net, savings goal. The agent proposes values from the imported data (auto-budget), and the user adjusts them | Core |
| F3 | **Unified overview**: cash plus investments across banks, spending by category, recurring payments, cash-flow forecast | Core |
| F4 | **Daily autopilot run**: the agent reviews new data against the goals and produces action items (budget alerts, insights on transactions, money routing such as "move surplus to savings", risk checks) | Core, the aha moment |
| F5 | **Notifications and action items**: a push/in-app notification leads to approve, dismiss, or ask-why. User feedback tunes future runs | Core |
| F6 | **Voice**: talk to the product with gpt-realtime. The server mints an ephemeral key and the client connects directly, with tools that read the user's data and action items | Showcase |
| F7 | **Advanced insights**: Danish mortgage refinancing (omlægning) and consumer-loan consolidation, with tax effects (rentefradrag) | Showcase, stretch |
| F8 | **Risk management**: concentration and drawdown on the Saxo portfolio against risk tolerance; safety-net coverage in months | Stretch |

## Demo path (proposed)

1. **Sign in** as the demo persona (fake sign-in, approved mock).
2. **Connect banks**: a "Demo connection" consent screen for Danske Bank, Revolut, and Saxo. Accounts import from fixtures.
3. **Set goals**: the agent proposes budgets and a safety net based on 90 days of history, and the user tweaks one.
4. **Overview**: one total across banks and categorized spending, with no double counting of the Danske→Revolut transfer.
5. **Time skip, "go live life"**: trigger the daily run for a later simulated date. A notification arrives with 2–3 action items (e.g. restaurant budget at 85% with 10 days left; DKK 3,000 surplus to move to savings; refinancing opportunity).
6. **Act**: approve the savings transfer (simulated) and open the refinancing insight with its tax effect.
7. **Voice**: "Can I afford a weekend in Lisbon next month?" The agent answers from live app data.

## Decisions

- Bank connections are **mocked** for the demo (developer decision), shaped like the documented APIs. The UI labels them "Demo connection", and the pitch says that the data is synthetic and that the app calculates the results. See [demo data availability](docs/demo-data-availability.md) for the fixture and its edge cases.
- Voice uses gpt-realtime with an ephemeral client key minted by the server (developer decision).

- **Platform:** a Next.js **PWA** on Vercel ([scaffold guide](.agents/skills/hackathon/references/scaffold.md)). It is mobile-first, installable on the phone's home screen, and has in-app notifications plus web push for the daily run (developer decision).
- **Sign-in:** a **fake sign-in screen** that logs in as the seeded demo persona. This is an approved mock; label it in the pitch (developer decision).
- **Autopilot agent:** **Claude** for the daily run (developer decision). It produces structured action items through tool use over the insights API. Deterministic code computes every amount; Claude explains, prioritizes, and never invents numbers.

## Proposed defaults (confirm or change)

- **Database:** libSQL client against SQLite locally and Turso for deployment. The single-persona state uses one JSON record with revision-checked updates, an expedient hackathon implementation. The scaffold retains Drizzle for future normalized tables. Fixtures enter through connector imports so the real calculations run on them.
- **Simulated clock:** a demo control advances "today" and triggers the daily run on demand. A real cron (Vercel Cron) can run the same entry point.
- **Money movement:** read-only plus *proposed* transfers. Approving one records the decision and updates fixture balances. No payment initiation (PIS).

## Shared interfaces (to agree early)

1. **Normalized data model**: accounts, balances, transactions (source, source account ID, original amount and currency, status, dates, optional merchant/counterparty, retrieval time), holdings, liabilities (mortgage entered by the user), and goals.
2. **Connector interface**: `listAccounts / getBalances / getTransactions / getHoldings` per bank. The fixture implementation sits behind the same interface a real provider (Enable Banking, Saxo OpenAPI) would use.
3. **Insights API**: deterministic functions such as categorize, recurring, budget status, forecast, safety-net months, surplus, and refinancing calc. Both the autopilot agent and voice tools call them.
4. **Action item**: `{id, runId, type, title, body, amount?, accounts?, severity, status: new|approved|dismissed, rationale, createdAt}`.

## Out of scope

Real bank credentials or live connections (unless time allows a recorded Enable Banking pull), real payments, regulatory advice claims, multi-user households, native mobile apps, real authentication, full tax returns.

## Open questions

| Question | Proposed answer |
| -------- | --------------- |
| Deadline (timezone), submission format, demo length, live or recorded, judging criteria | Intro transcript is available in docs/intro.md. It suggests presentations around 19:45 Copenhagen and a 30-day impact plan; exact deadline and submission still need confirmation |
| Product name | Autopilot is the current working name; final name remains open |
| Mortgage/loan data source | User-entered sample liability during onboarding, labelled as such (open banking does not provide it) |
| Refinancing and tax rules | Simplified calculator with stated assumptions (current bond price/rate, fees, rentefradrag rate), verified by a research worker before the pitch |
