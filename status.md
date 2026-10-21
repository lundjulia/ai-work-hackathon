# Status

## Timeline

- **Deadline:** unknown (needed from the developer, with timezone)
- **Submission:** unknown
- **Demo format:** unknown (live or recorded, length)
- **Freezes:** none

## Summary

Building. Developer decisions are in the [PRD](PRD.md): Next.js PWA, fake sign-in (mock), Claude for the autopilot agent, gpt-realtime for voice, and mocked bank connections. The scaffold runs locally (8ca88b5), but the deploy is blocked on the Vercel team choice and Turso credentials. The finance core is in progress. UI and voice workers are starting. Next integration target: finance wired into the app, with fixture data on Home.

## Work

| Outcome | Owner / task | State | Dependency or blocker | Result / evidence |
| ------- | ------------ | ----- | --------------------- | ----------------- |
| PRD + status | main | draft | Developer answers to open questions | PRD.md |
| Scaffold + Vercel deploy | scaffold worker → main | done locally; linked to Vercel `quasr/claude-impact-lab` (CLI deploys; GitHub auto-connect to lundjulia/ai-work-hackathon failed, not needed) | Developer is creating a Turso DB → put DATABASE_URL/DATABASE_AUTH_TOKEN in apps/web/.env, then main runs env:production + deploy:prod | Commits 664b628 (scaffold), 8ca88b5 (shell + PWA). `pnpm build` passes (routes /, /actions, /goals, /talk, /signin, /onboarding, /manifest.webmanifest, /api/trpc; Proxy). `pnpm dev` + curl: signed-out pages 307 → /signin; POST sign-in action → 303 /onboarding with `demo_user=sofie` (httpOnly); with cookie all tabs 200 with headings; manifest, /sw.js (no-cache), icons, /api/trpc/healthCheck 200. Not deployed yet. `packages/finance` not wired (absent at finish) |
| Fixtures + connectors + data model | finance worker | ready for integration | Main owns app integration | Synthetic 90-day fixture connectors + stable imports and consent fallback. Oct19 cash DKK52,744.57, positions95,000, total147,744.57. |
| Insights engine (budgets, recurring, forecast, refinancing) | finance worker | ready for integration | Main runtime checks pending | Pure `getSnapshot`, `proposeGoals`, `generateForecast`; money and finding facts computed in code. Node24 monetary tests + package type check. [Finance API and assumptions](docs/finance.md). |
| Autopilot daily run + action items | backend worker | implemented; local state verified | Real Turso credentials and ANTHROPIC_API_KEY needed for remote/live checks | GET/POST `/api/demo`, server-owned JSON state with optimistic SQL revisions; forced Claude candidate selection; atomic exactly-once simulated approvals; feedback suppression. 11 focused local SQLite tests pass and web typecheck passes on working tree 2026-10-21. HTTP checks: absent/wrong cookie 401, run without key 503, extra approval amount rejected 400. No remote Turso migration or live Claude call verified. [Backend details](docs/autopilot.md) |
| Onboarding, goals, overview, notifications UI | UI worker | in progress | Finance API for data-bound screens | |
| Voice (gpt-realtime) | voice worker | finance state integrated; focused checks passed; live voice unverified | OPENAI_API_KEY absent at check | [docs/voice.md](docs/voice.md). All 6 tools load the same persisted state as the app; affordability uses core forecast and 90-day bounds. Web tsc passed; API connected banks/saved fresh goals/advanced Oct26 and matched Home totals/spending, then reset baseline. Malformed/wrong-user/foreign-Origin/body bounds checked. Direct approved transfer and unfamiliar amount/date checks passed. Session GET configured:false, POST503. Not verified: OpenAI secret mint, WebRTC/model roundtrip, microphone, phone |
| Penny family food-budget app (`apps/penny`) | penny main thread | demo path verified locally | ANTHROPIC_API_KEY absent; Claude paths unverified | Separate Next.js app on port 3002, Figma-based. Chrome check 2026-10-21 at phone width from empty storage: onboarding → simulated Nexi connect (26 receipts) → Simulate receipt: categorized, weekly food budget 1,054→840 kr, Penny cheer and tip, goal 6,400→6,860 kr. `pnpm --filter penny build`, check-types, lint and three self-checks pass. Live Tjek offers API works. [Penny PRD](docs/penny-prd.md) |
| Brand, name, pitch deck | — | not started | Demo path stable | |

## To reconcile

- Google Drive MCP fails auth ("does not support dynamic client registration"), so the event context is not available to agents.

## Demo candidate

None yet.
