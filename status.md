---
provenance: Unvetted Synthetic
---

# Status

## Timeline

- **Deadline:** unknown (needed from the developer, with timezone)
- **Submission:** unknown
- **Demo format:** unknown (live or recorded, length)
- **Freezes:** none

## Summary

The primary conversation demo works locally. Home is Penny with voice and typed artifacts; onboarding gathers a plan conversationally and saves it after explicit confirmation. Real Haiku browser onboarding and notification-to-conversation were exercised with shared stored settings. The user confirmed audible GPT-Live voice and a matching grocery-budget card. The stale inherited key and incorrect Realtime handshake were corrected by the main build thread, which reports final web/Penny production builds passing. Shared Nexi line classification/payment allocation, editable loans, phone QA and deployment remain unfinished. [Rehearsal script](docs/demo-script.md).

## Work

| Outcome | Owner / task | State | Dependency or blocker | Result / evidence |
| ------- | ------------ | ----- | --------------------- | ----------------- |
| PRD + status | main | draft | Developer answers to open questions | PRD.md |
| Scaffold + Vercel deploy | scaffold worker → main | done locally; linked to Vercel `quasr/claude-impact-lab` (CLI deploys; GitHub auto-connect to lundjulia/ai-work-hackathon failed, not needed) | Local-data migration replaces database setup; AI keys still needed before live checks/deploy | Commits 664b628 (scaffold), 8ca88b5 (shell + PWA). `pnpm build` passes (routes /, /actions, /goals, /talk, /signin, /onboarding, /manifest.webmanifest, /api/trpc; Proxy). `pnpm dev` + curl: signed-out pages 307 → /signin; POST sign-in action → 303 /onboarding with `demo_user=sofie` (httpOnly); with cookie all tabs 200 with headings; manifest, /sw.js (no-cache), icons, /api/trpc/healthCheck 200. Not deployed yet. `packages/finance` not wired (absent at finish) |
| Fixtures + connectors + data model | finance worker | ready for integration | Main owns app integration | Synthetic 90-day fixture connectors + stable imports and consent fallback. Oct19 cash DKK52,744.57, positions95,000, total147,744.57. |
| Insights engine (budgets, recurring, forecast, refinancing) | finance worker | ready for integration | Main runtime checks pending | Pure `getSnapshot`, `proposeGoals`, `generateForecast`; money and finding facts computed in code. Node24 monetary tests + package type check. [Finance API and assumptions](docs/finance.md). |
| Autopilot daily run + action items | backend → main | real Haiku browser review passed | Combined receipt workflow pending | `claude-haiku-5-5` confirmed by model list; unsupported temperature removed with red/green request regression. Browser run committed three computed actions at revision 8. Shared deterministic operations; bounded snapshot POST; stale response protection. [Backend details](docs/autopilot.md) |
| Onboarding, goals and bank overview | UI worker → main | integrated and browser checked locally | Combined family UI pending | Main walkthrough: sign-in, three consent/import flows, restaurant budget adjustment, saved goals and Home total DKK147,744.57. Missing Claude shown explicitly. |
| Local-data storage migration | main + Components + backend | integrated; Components handoff complete | Without Web Locks the retry fallback is not a cross-process transaction | Runtime SQL consumers and SSE removed. Components reports 23 focused tests and final web tsc exit 0. Two tabs, reload, disabled-BroadcastChannel storage fallback checked; restored baseline revision 4. No paid calls/build/deploy by Components |
| Voice onboarding, primary assistant and notification demo | status thread + assistant_tools/UI/chat workers | real browser plan save and notification conversation passed | Full spoken onboarding and phone QA remain | Haiku generated a full plan, explicit Save persisted it at revision 12, and notification conversation used the new grocery limit. User confirmed audible voice/card. 26 focused notification/store/tool/chat tests pass |
| Assistant conversation UI and artifacts | assistant_ui → main + Live protocol worker | browser verified for settings and budget cards | Broader artifact/phone QA remains | Penny avatar, primary tap-to-talk, real Haiku text field, typed budget/goal/forecast/action/settings cards. Settings confirmation applies local operation with revision CAS and refreshes shared state. Action buttons notify assistant after persistence. Pre-Live-hook web tsc exited 0; component diff check clean. No live audio claim |
| Shared Nexi receipt processing and allocation | unassigned | not integrated | Receipt contract/allocation | Separate Penny fixture/UI available. Current bank-app Nexi notification is a labelled simulation without budget changes |
| Editable property/mortgage/car loans | unassigned | not implemented | Shared household state inputs | Existing calculators use fixed fixtures. |
| Azure GPT-Live voice | voice → main | user verified audible answer and matching budget card | Phone and broader conversation QA remain | User replied "Yes, voice and card work" after asking "How is our grocery budget doing?" on localhost3001. Live SDP transport + Haiku delegation. Earlier 401 was inherited-key override and wrong Realtime API, now resolved. [Voice details](docs/voice.md) |
| Brand, name, pitch deck | presentation thread → main | updated and browser checked | Live demo needs on-stage rehearsal; no audience URL | Six slides: 2-minute pitch + 1-minute demo. Latest Google Doc read through Drive export at 19:36 Copenhagen; sourced 33% global 2014 survey, Julia-owned five-family pilot with 3-of-5 target. Offline HTML, editable PowerPoint with notes and timed script in docs/presentation. All slides fit 1280×800; navigation/fullscreen/images checked. |
| Penny family food-budget app (`apps/penny`) | penny main thread | demo path verified locally | ANTHROPIC_API_KEY absent; Claude paths unverified | Separate Next.js app on port 3002, Figma-based. Chrome check 2026-10-21 at phone width from empty storage: onboarding → simulated Nexi connect (26 receipts) → Simulate receipt: categorized, weekly food budget 1,054→840 kr, Penny cheer and tip, goal 6,400→6,860 kr. `pnpm --filter penny build`, check-types, lint and three self-checks pass. Live Tjek offers API works. [Penny PRD](docs/penny-prd.md) |

## To reconcile

- Separate `apps/penny` now exists with its own state, receipt/goal semantics and Claude models. Reuse its UI/fixtures before duplicating family work; reconcile fallback classification, projected-surplus goal boosts, category allocations and Haiku-main routing. No shared-state or voice integration is verified.

- Google Doc export read successfully through direct authenticated Drive API. Local MCP currently fails to attach credentials; no authentication changes made.
- Confirm whether supermarket offers/meal planning are part of the demo. Keep both family and bank/mortgage tracks per developer decision.
- Deadline, submission route and demo length remain unconfirmed. Transcript suggests presentations around 19:45 Copenhagen.
- Browser storage with bundled fixtures is integrated. No Turso credentials are required. Same-origin tabs share state; different devices and closed-browser background jobs do not.
- Claude Haiku 5.5 daily review and GPT-Live audible budget reply/card are verified. Stale inherited Azure key and incorrect Realtime protocol were corrected. Invalid scaffold production vars were removed from Vercel.

## Demo candidate

Local voice-first conversation candidate on http://localhost:3001, based on the current shared working tree. It is not a complete combined Nexi/bank/loan candidate. Real browser onboarding, confirmed saved plan, notification stack and contextual budget card were verified; the user confirmed audible voice with a matching card. Main reports final root production build passing for web and Penny. The demo remains uncommitted and unpublished. [Exact script and limits](docs/demo-script.md).

## Integration evidence on 2026-10-21

- Main production build passed after Azure transport migration.
- Main combined browser/storage/HTTP/provider/backend check passed 38 tests, skipped the missing-key route case because Azure key is set. Initial command failed because the root runner did not resolve the web path alias; rerunning with web tsconfig passed. Voice separately ran the missing-key case successfully with an empty-key override.
- Real browser daily review persisted three actions and showed them on Actions after navigation. Haiku 5.5 review then passed at revision 8. Tests reproduce its rejected temperature parameter before the fix and pass after omitting it.
- Budget-card caption corrected from "left this month" to "spent this month" to match the computed amount. Local system notifications have code support with permission, but push subscription/sender and closed-browser review are absent.

- Final post-Haiku `pnpm build` exited 0. Backend 12/12 tests passed. Browser Actions showed all Haiku-selected actions and two "spent this month" captions. Baseline restored with a new revision 9, no banks, onboarding false, groceries 3400 and no runs.

- Updated Azure configuration to the supplied Foundry services endpoint. Both hostname forms and the models-list request still return 401 with the supplied credential; Bearer auth also returns 401. Endpoint validation now supports the documented services hostname.

- Corrected Azure diagnosis: inherited AZURE_OPENAI_API_KEY overrides the valid file credential. Direct file-key Live probe returns 400 invalid_offer, proving authentication; Realtime mint returns 400 model operation unsupported. gpt-live-1 requires `/openai/v1/live/sessions` and Live events, with no ephemeral client key. Earlier 401 credential/resource conclusions are superseded. Migration from Realtime remains required before live audio.

- GPT-Live fix integrated: local dev launcher loads file Azure settings over stale inherited key; active voice uses backend Live SDP exchange and client delegation to Haiku. Real session200, accepted SDP, connected WebRTC/openchannel/session.started verified.12 focused tests pass,1 missing-key skip; web tsc0. Microphone/audible conversation/delegation roundtrip not yet verified.

- Final root production build exited0 for web and Penny after GPT-Live fix. Diagnostic quiet context received session.thinking.appended; microphone-free session later closed. No audible or sustained voice claim.

## User and family UI handoff evidence

On 2026-10-21 the user confirmed "Yes, voice and card work" after asking "How is our grocery budget doing?" through the localhost3001 microphone. The audible answer and matching card were confirmed by the user, not inferred from automation.

The family UI owner reports real Haiku onboarding produced a settings card for income 32000, budgets 3500/1500/1000/1200/600/900, cautious risk, three-month buffer and a 20000 bike goal for 2027-06-01. Explicit Save persisted the plan with onboarding true at revision 12. A budget demo notification opened contextual Haiku chat and a groceries card matching the new 3500 limit. Automation without a microphone used the truthful text fallback. Receipt events remain simulations with no financial changes; shared classification and payment allocation are missing. No additional build or restart followed this evidence handoff.

- Status thread real browser rehearsal: Nexi + Danske connected, Haiku full settings proposal, explicit Save, shared state revision 12 with income 32000 / groceries 3500 / conservative / buffer 3 / family bike 20000 by 2027-06-01. Budget event added a notification; opening it produced a contextual reply and card using the saved 3500 grocery limit.
- After GPT-Live protocol migration, 26 focused notification/store/tool/chat tests passed. One test request was updated to include the now-required SDP field. Signed Haiku thinking response regression failed before the parser fix and passed after; only answer text is rendered.
- User verified audible reply and matching card for “How is our grocery budget doing?” on localhost3001. This does not prove phone behavior or a complete spoken onboarding sequence.

- Prompt cold-read draft/audit completed. It now re-presents unseen suggestions before group acceptance, asks for an exact savings deadline, and keeps sample receipt notifications distinct from actual spending. Final tools5/5 and web typecheck pass after those clarifications. Reloaded Home retained income32000, groceries3500 and the read notification.
