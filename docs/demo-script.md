---
provenance: Unvetted Synthetic
---

# Money on autopilot demo script

Working name: Autopilot. The product name is still open. Deck: `apps/web/public/pitch/index.html`.

This rehearsal assumes a three-minute slot. The developer has not confirmed the time limit or submission route. The event transcript mentions presentations around 19:45 Copenhagen and a 30-day impact plan, but it is not a confirmed team deadline.

## Before presenting

The main thread must reconcile the final candidate with this script. The script describes the intended demo path, not a completed end-to-end check.

- Add the verified candidate revision, environment, screenshot and public URL below.
- Only show the daily run as Claude if the real Claude request and resulting actions passed verification. A deterministic replacement has not been approved.
- Include live voice only after secret minting, microphone consent, WebRTC connection and a data-tool round trip pass. If they remain unverified, describe the implementation briefly and skip the live interaction.
- Start from the seeded Sofie persona and rehearse the exact path. Do not change shared demo state during someone else's rehearsal.
- Keep a recording or screenshots of the verified path as a fallback. Say that a fallback is recorded, with synthetic data and simulated transfers.

Candidate evidence awaits main-thread integration:

| Item | State |
| --- | --- |
| Revision and runtime | Pending |
| Public audience URL | Pending |
| Sign-in through bank import and goals | Pending integrated verification |
| Overview and calculated amounts | Pending integrated verification |
| Real Claude daily run and action items | Pending API key and live verification |
| Approve, dismiss and simulated balances | Pending integrated verification |
| Voice with app-data tool response | Implemented; live unverified |
| Daily schedule and notification delivery | Pending end-to-end verification |

## Three-minute rehearsal

| Time | Slide and action | Suggested words |
| --- | --- | --- |
| 0:00 to 0:20 | Slide 1, attention problem | "Our demo persona Sofie has her salary at Danske Bank, card spending at Revolut and investments at Saxo. To decide what she can save, she has to reconcile several apps. Our hypothesis is that she wants a useful action without a daily money routine." |
| 0:20 to 0:40 | Slide 2, product promise | "Money on autopilot is designed around a simple promise: go live your life. Set your budgets, safety net and savings goal. The daily agent reviews your finances and contacts you when there is something to act on. You decide whether to approve, dismiss or ask why." |
| 0:40 to 1:45 | Slide 3, demonstrated candidate only | "This is a fictional user and synthetic bank data. We use demo sign-in and consent screens. Here are the connected accounts and Sofie's goals. Now we move the demo clock forward and run the daily review. The calculation gives this action its amount. Sofie can inspect the reason and approve this savings transfer. It updates demo state only; no real money moves." |
| 1:45 to 2:15 | Slide 4, mechanism | "The code calculates budgets, forecast cash flow, safety-net coverage and surplus. Claude's intended job is to select and explain actions using those calculations. The finance engine owns the amounts. The app is a Next.js PWA with Turso state. Voice uses gpt-realtime and the same app data." |
| 2:15 to 2:35 | Slide 5, actual evidence | "Our verified candidate demonstrates [only the steps recorded above]. Bank connections, sign-in and transfers are demo simulations. We have not measured user impact yet. [Name any remaining live AI or notification gap plainly.]" |
| 2:35 to 3:00 | Slide 6, proposed impact plan | "Over the next 30 days, we propose testing with five people who use several banks. First record their current routine. Then check the advice against their data and log useful, dismissed and incorrect alerts. At the end, compare weekly money-admin minutes with the baseline. Help us test the first useful action." |

The time ranges are rehearsal allocations, not engineering estimates. Replace the bracketed final-evidence line with the main thread's observed result before presenting.

## Live demo path

1. Sign in as Sofie through the labelled demo sign-in.
2. Connect Danske Bank, Revolut and Saxo through their demo consent flow.
3. Show the calculated proposed goals and adjust one budget.
4. Show the unified overview. Point out that an internal transfer is not counted as spending twice.
5. Advance the simulated date and trigger the daily run, if the real Claude path has passed verification.
6. Open an action, read its calculated amount and rationale, then approve a simulated savings transfer. Show the new action status and balance.
7. If live-verified, ask voice: "Can I afford a weekend in Lisbon next month?" State the price and dates if the agent asks. The answer must reflect the current app state.

Exact amounts come from the final candidate. Do not rehearse a hardcoded DKK 3,000 savings result or a preset Lisbon verdict unless the current state calculates it.

If Claude remains blocked, show only the verified onboarding, goals and finance overview. Say: "The calculation layer is implemented. The real Claude daily run is pending configuration and verification." Do not present deterministic actions as a live Claude run.

If a live path fails, move to its verified recording or screenshot and label it. Without a verified fallback, explain the intended behavior as a design.

## Deck evidence handoff

The template's `deck.css` and `deck.js` remain unchanged. The main thread can update these IDs in `index.html` without changing layout or controls:

- `demo-evidence-slot`: replace with an actual candidate screenshot, saved next to the deck with a relative image path and accurate alt text.
- `demo-evidence-caption`: label the image's date, candidate state and simulation limits.
- `candidate-evidence`: list the demonstrated workflow and verification environment.
- `candidate-link`: add a clickable, readable audience URL after deployment verification.

Present with arrow keys. `F` requests fullscreen and `?` opens the controls. A local URL is a rehearsal route, not an audience URL.
