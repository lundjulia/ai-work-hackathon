# Penny — family budget coach

A calm household budget app for families: receipts flow in from Nexi Smart Receipt (faked for the demo), AI sorts them, and Penny, an openly-AI mascot, cheers you toward a savings goal. Mobile-first PWA.

## Run it locally

You need [Node.js 20+](https://nodejs.org) and pnpm (`npm install -g pnpm`).

```bash
git clone -b penny-app https://github.com/lundjulia/ai-work-hackathon.git
cd ai-work-hackathon/apps/web
pnpm install
pnpm dev
```

Open http://localhost:3000 (Next.js picks another port if 3000 is busy; check the terminal). For the phone look, open Chrome DevTools and switch to a phone view.

**Optional, for real AI:** copy `.env.example` to `.env.local` and add an Anthropic API key. Without a key, Penny's answers and receipt sorting use built-in rules, so the demo still works.

**Try it on your phone:** run `pnpm dev -H 0.0.0.0`, then open `http://<your-computer's-IP>:3000` on a phone on the same Wi-Fi.

## Demo flow

1. **Get started** → **Connect with Nexi** → **Allow** (simulated, imports 26 receipts).
2. On Home, tap **Simulate incoming receipt**: the receipt arrives → AI categorizes it → the weekly food budget updates → Penny cheers with a tip → the Italy goal moves.
3. Explore **Budget** (where the money goes), **Meals** (live offers from Netto, Bilka, Føtex, Rema 1000 and Lidl, compared by kr/kg), **Penny** (ask anything; try "Should we invest in stocks?") and **Goals**.
4. To start over: **Goals → Family settings → Reset demo** (or clear the site's storage).

Product context: [PRD.md](PRD.md) · [status.md](status.md) · [docs/design.md](docs/design.md) (Figma baseline) · [docs/nexi.md](docs/nexi.md) · [docs/offers.md](docs/offers.md)

---

# hckthn

https://drive.google.com/drive/folders/1g5H0jGdhj13NfrhxoRa9aI-Vjjd_4aZi?usp=sharing

A hackathon template for developers and agents. Keep context in the repository, get started quickly, and adapt as the idea takes shape.

- [Hackathon skill](.agents/skills/hackathon/SKILL.md): coordinate main and worker threads, with guides for the [app scaffold and Vercel deploy](.agents/skills/hackathon/references/scaffold.md), [branding](.agents/skills/hackathon/references/branding.md), and a reusable HTML presentation.
- [Hackathon playbook](docs/hackathon_playbook.md): a flexible thought scaffold for setup, ideas, planning, building, and the demo.
- [AGENTS.md](AGENTS.md): coding guidelines; adapt to the project as needed.

## Get started

Use `$hackathon` (Codex) or `/hackathon` (Claude Code) in the main thread. Include the skill in worker briefs so both roles share the same workflow. Tools that do not discover repository skills can read `.agents/skills/hackathon/SKILL.md` directly.

Capture the hackathon context, sketch out `PRD.md`, and scaffold the app with the [scaffold guide](.agents/skills/hackathon/references/scaffold.md). Use an existing status document or create `status.md` when parallel work needs a shared record. Any agent can update it; the main thread reconciles requirements, changes, and evidence as work arrives.
