# Status

Deadline: _TBD (ask developer)_ · Demo candidate: first pushed commit on main (demo path verified in Chrome on 2026-10-21; AI ran on rule fallback, no API key)

| Track | Owner | Files | State |
|---|---|---|---|
| Shell, avatar, PWA, login, dashboard, budget | worker-shell | layout, globals.css, `/`, `/budget`, `/login`, `components/avatar`, `components/nav`, `components/auth-gate.tsx`, `components/sw-register.tsx`, `app/manifest.ts`, `app/icon.svg`, `public/` sw+icons | built to Figma baseline; tsc+lint clean; not yet run in browser (SW registers in prod only). `lib/nexi/simulate.ts` is a temp stub until worker-nexi replaces it |
| Nexi fake + demo flow + notifications + categorization | worker-nexi | `/connect`, `/receipts`, `/notifications`, `lib/nexi` (client, categorize, simulate), `lib/coach.ts` + `coach.test.mjs`, `api/categorize`, `data/receipts.json`, `docs/nexi.md` | done: tsc+lint clean, `node src/lib/coach.test.mjs` passes, demo flow run headless in node over seed + incoming pool (rules path). Not run in browser; Claude path untested (no API key) |
| AI advisor + goals/profile/pledges | worker-advisor | `/advisor`, `/goals`, `api/advisor`, `lib/advisor` | done, awaiting integration: tsc+lint clean on own files; fallback self-check passes (`node src/lib/advisor.check.mjs`); Claude path + UI not run in a browser |
| Offers / meal planning | worker-offers | `/meals`, `lib/offers`, `data/offers.json`, `api/offers`, `docs/offers.md` | done: real Tjek snapshot (60 offers) + live API w/ fallback; tsc/lint/self-check pass; not yet run in browser |
