---
provenance: Unvetted Synthetic
---

# Combined scope review

Source: [Problem + Idea](https://docs.google.com/document/d/1c3nieExbHYsZclCYt0nbJxO-dADehgvwg7vWb-QFu2M/edit). Read the Drive text export on 2026-10-21; its modified time was 16:35:06 UTC, 18:35 Copenhagen. Direct authenticated Drive API export worked. The local MCP failed to attach credentials; the Docs API is disabled, so tab-specific content and comments were not inspected.

The document combines earlier bank-autopilot and mortgage ideas with a newer family receipt-budget demo. The developer explicitly chose to keep both after this review. Neither track supersedes the other.

## Product understanding

The target is a Danish family managing everyday money without having to study personal finance. The promise combines calm household budgeting and progress toward a chosen goal with an agent that reviews connected accounts and financial commitments. The family chooses what to change or do with savings.

The new demo starts with receipt-level food spending. Nexi Smart Receipt connection and receipt arrival are explicitly simulated. AI categorizes receipt items, the budget updates, and a friendly, openly AI avatar offers encouragement and a practical suggestion. Voice explains the receipt, budget or broader finances in plain language. A simulated notification screen is explicitly requested.

The original bank overview, goals, risk checks, daily review and Danish mortgage/loan insights remain part of the intended app. Houses, mortgages, car loans and interest rates need user entry. The app may compare financial options with stated assumptions; it must not choose securities or execute investments for the family.

## What exists and can be reused

- Next.js PWA, labelled demo sign-in, onboarding and shared UI components.
- Connected synthetic bank fixtures, cash and investment overview, spending budgets, goals and forecasts.
- Browser-local state with versioned records, revision-checked updates and cross-tab invalidation.
- Stateless Claude daily review over supplied snapshots, computed findings and simulated approvals. Main passed real Claude and Haiku 5.5 browser daily-review rehearsals.
- Six read-only voice tools over fresh browser snapshots. Azure provider migration is assigned; microphone, WebRTC and live deployed-model interaction are unverified.
- Mortgage refinancing and consumer-loan calculations on fixed sample liabilities, with illustrative tax and quote assumptions.

The browser walkthrough passed sign-in, all three bank consent/import flows, an adjusted restaurant budget, onboarding save without Claude, and the integrated Home overview. A production build passed before the final finance guard and formatting changes; rerun after implementation settles. Finance reports 20 focused tests; backend reports 11 local SQLite tests. These checks do not establish the new receipt flow.

## Gaps introduced or clarified by the new scope

- No Nexi button, receipt importer, line-item receipt model or receipt history exists.
- Current categorization is deterministic merchant rules. Receipt AI categorization is new work.
- No family avatar, receipt arrival demo or positive notification screen exists.
- No persisted household or user-entered property/car-loan editor exists. Current liabilities are fixed fixtures.
- Voice cannot read receipts or household recommendations yet.
- No catalog of supermarket offers, comparable product weights or meal recipes exists. The document asks about meal planning as a question; it does not settle its role in the main demo.
- Current pitch covers the earlier bank demo and needs rewriting around both tracks.

## Plan

1. Define one household and a synthetic receipt JSON contract. Include receipt ID, store, purchased date, total, line items, quantities, units and prices. Match receipts to bank payments by an explicit fixture link; a receipt enriches a payment and must not add the purchase to spending twice.
2. Add the labelled Nexi connection and a demo receipt-arrival control. Claude categorizes receipt items through a validated schema. Code reconciles line totals and computes budget totals; failed AI processing remains recoverable and cannot silently show a completed categorization.
3. Make the food budget and goal visible on one calm family screen. Add an openly AI avatar, encouraging tips and the requested simulated notification screen. Show projected savings separately from saved money. Avoid increasing the goal merely because a receipt arrived or because the family has not spent its remaining budget.
4. Extend voice to current receipts, food spending, goal progress and recommendations while keeping the existing bank tools.
5. Add editable property/mortgage and car-loan inputs to the shared household state. Retain the bank overview and daily autopilot. Compare repayment/refinancing/saving scenarios with explicit assumptions and family choice; Fairrente/bond-buyback comparison needs product and input verification before financial claims.
6. Verify the combined demo, then update the pitch and 30-day impact plan around demonstrated behavior. The story can begin with a receipt and continue to the bank overview and mortgage scenario; final rehearsal depends on the actual presentation time limit.

## Decisions and unresolved details

Confirmed: retain both family and bank/mortgage features, mobile PWA, simulated Nexi connection, synthetic banks/sign-in, simulated notification screen and transfers, realtime voice, and browser-local data with bundled fixtures instead of a database.

Still open: avatar identity/name, whether supermarket offer and meal comparisons enter the demo, recipe/offer source, desired monthly savings contribution versus target amount, exact presentation length and deadline. Where unit-price comparisons are implemented, use comparable currency per kg/litre or a declared unit and retain package weight, offer dates and conditions. Shop names alone are insufficient evidence of savings.

The document's 33% literacy statistic is a global S&P survey claim, not a verified Danish-family baseline or measured product impact. Confirm the survey year, definition and source before using it in the pitch. Do not infer that every other respondent needs this product.

The developer subsequently chose browser storage with bundled fixtures. No Turso credentials are required. Components completed local persistence/cross-tab notifications/voice snapshots, and backend completed shared operations and stateless Claude requests. Components reports 23 focused tests and two-tab/reload/storage-fallback checks; earlier SQLite checks describe the superseded implementation.

The agent-first thread confirmed voice conversation as the primary interface. Tools should return typed visual artifacts alongside computed facts, using configurable categories through `show_budget({category,period})`. Azure OpenAI replaces direct OpenAI; the user supplied endpoint `https://j-hckthn-impact-resource.openai.azure.com/openai/v1` and deployment `gpt-live-1`. Claude remains the daily/receipt agent. [Current seams](seams.md) records present behavior, gaps and independent ownership. There is no deployed audience URL yet.
