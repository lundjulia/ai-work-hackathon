# Nexi Smart Receipt (faked integration)

## What it is (researched 2026-10-21)
- **Nexi Smart Receipt** is the consumer app/brand formerly known as **Storebox** (built by Nets, now Nexi; iOS app still © Storebox ApS). Free for consumers; 7,500+ shops across DK, NO, SE, FI.
- Consumer registers payment card(s); paying with a registered card auto-identifies them and the shop forwards a **digital receipt with line items**. Only receipts from after sign-up; manual upload exists for non-member shops.
- The documented API is **merchant-side**: the Storebox/Nexi Engage POS API lets a shop *send* receipts (JSON) identified by phone, email or tokenized card (PAN). Merchants can deliver receipts to their own app, to Smart Receipt, or both.
- We found **no public consumer/third-party read API** (no documented OAuth consent or webhooks for apps like ours). Pleo has a Storebox integration (DK only), which shows partner read access exists in practice.

Sources: [nexigroup.com Smart Receipt](https://www.nexigroup.com/en/business/consumers/smart-receipt/), [FAQ receipts](https://www.nexigroup.com/en/business/consumers/smart-receipt/faq-receipts/), [Nexi Engage POS API](https://dev-engage.nexigroup.com/pos-api.html), [Pleo × Storebox](https://integrations.pleo.io/integrations/storebox), [App Store](https://apps.apple.com/app/id688349260).

## Our assumed partner API (what the fake mimics)
Assumption, approved as a fake by the developer: a partner read API like the one Pleo uses.

| Step | Assumed call | Fake in `apps/web/src/lib/nexi/client.ts` |
|---|---|---|
| Consent | OAuth 2 auth-code flow, scope `receipts:read` ("Allow FamilyBudget to read your receipts") | `connect()` → resolves after ~1.2 s with `{ accessToken, scope, expiresAt }` |
| Backfill | `GET /v1/receipts?since=<ISO>` → `{ receipts: NexiReceipt[] }` | `fetchReceipts()` → `src/data/receipts.json` |
| Live | Webhook `receipt.created` with one `NexiReceipt` | `nextIncoming()` pops from a pool; demo button "simulate receipt" |

Receipt payload = `Receipt` in `apps/web/src/lib/types.ts` minus our AI fields (`category`, `aiNote`): `id, merchant, chain, date, total, lines[{ name, qty, kgPerUnit?, price }], source: "nexi"`. `kgPerUnit` is our assumption (real receipts often carry weight for loose goods; we parse it from pack sizes otherwise).

Categorization is ours: `POST /api/categorize` (Claude Haiku when `ANTHROPIC_API_KEY` is set, keyword rules otherwise).
