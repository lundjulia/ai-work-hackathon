---
provenance: Unvetted Synthetic
---

# Money on autopilot

A mobile-first finance demo for a fictional Danish user. Connect synthetic Danske Bank, Revolut and Saxo accounts, set goals, and review computed spending and cash flow. The daily Claude agent selects action items from deterministic calculations. Voice reads the same stored state through gpt-realtime tools.

Start locally:

```sh
pnpm install
pnpm dev:web
```

Open http://localhost:3001 and continue as the demo user. Configuration lives in `apps/web/.env`, with declared keys in `apps/web/.env.schema`. Local SQLite works for rehearsal; production requires a real Turso `DATABASE_URL` and `DATABASE_AUTH_TOKEN`. Add `ANTHROPIC_API_KEY` for daily runs and `OPENAI_API_KEY` for live voice. Missing AI keys leave the corresponding feature explicitly unavailable. The demo state table initializes on first signed-in API read; no schema push is needed for that table.

Useful checks:

```sh
pnpm build
pnpm check-types
pnpm --filter @claude-impact-lab/finance test
pnpm exec varlock run --path apps/web -- pnpm exec tsx --test apps/web/src/lib/server/demo-backend.test.ts
```

The deck is at http://localhost:3001/pitch/index.html. [Status](status.md) records checked behavior and remaining delivery work. [Demo script](docs/demo-script.md), [finance calculations](docs/finance.md), [autopilot persistence](docs/autopilot.md), and [voice](docs/voice.md) describe the implementation and its limits.

Bank connections, sign-in and money movement are approved demo simulations. Calculations run on synthetic fixture data. This app does not connect real banks or initiate real payments. The single-persona JSON state record is an expedient hackathon implementation; [autopilot notes](docs/autopilot.md) describe the durable architecture needed for multiple users.

Deployment uses the linked Vercel project through `pnpm env:production` and `pnpm deploy:prod`. Environment sync rejects local-only URLs for production and preview.

Event context: [intro transcript](docs/intro.md), [shared Drive folder](https://drive.google.com/drive/folders/1g5H0jGdhj13NfrhxoRa9aI-Vjjd_4aZi?usp=sharing), [Drive integration](docs/google-drive-mcp.md). Agent workflow: [hackathon skill](.agents/skills/hackathon/SKILL.md), [playbook](docs/hackathon_playbook.md), [requirements](PRD.md).
