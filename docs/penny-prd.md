# PRD — Family budget coach (hackathon demo)

Full original brief: [docs/brief.md](brief.md). Design baseline (Figma): [docs/design.md](design.md). Status: [status.md](../status.md).

**Problem:** Families lose track of the household budget and feel stressed at month end.
**User:** A busy parent who wants to see where money goes, what's left, and save toward a goal — without studying finance.
**Demo:** Food budget tracker (first category of a household budget) with a savings goal on top.
**Demo flow:** Receipt arrives via Nexi Smart Receipt (faked) → AI categorizes → budget updates → avatar cheers + gives tip → savings goal moves.

## Decisions
- Stack: Next.js 16 app in `apps/penny` (App Router, Tailwind v4, shadcn/ui, zustand persisted to localStorage). No DB, no real auth — demo user sign-in. Installable PWA, mobile-first.
- Nexi Smart Receipt integration is **faked** (approved by developer): "Connect with Nexi" button assumes success; receipts are JSON shaped like a plausible Nexi payload.
- AI: Claude via `@anthropic-ai/sdk` in Next route handlers when `ANTHROPIC_API_KEY` is set; deterministic rule-based fallback otherwise so the demo never breaks.
- Avatar **Penny** (from Figma): friendly, openly-AI character (Duolingo-owl spirit), never judging. Positive framing always.
- AI never recommends specific investments. It shows what's possible to save; the family decides.
- Grocery offers: Netto, Bilka, Føtex, Rema 1000, Lidl; compare by **kr/kg**, not per item.

## Shared contract
`apps/penny/src/lib/types.ts` and `apps/penny/src/lib/store.ts` (main thread owns; propose changes).

## Routes
`/login` onboarding · `/` home (weekly food budget) · `/budget` where money goes · `/connect` Nexi · `/receipts` · `/notifications` · `/meals` offers & meal planning · `/advisor` AI chat · `/goals` goals & profile & pledges

## Out of scope
Real Nexi API, real auth, server persistence, investment advice.
