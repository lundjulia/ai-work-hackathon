---
provenance: Unvetted Synthetic
---

# Voice-first demo rehearsal

Open http://localhost:3001. The demo uses synthetic bank data, a simulated Nexi connection and in-app event notifications. Claude Haiku provides financial conversation and tools; Azure GPT-Live provides audio. No real money moves.

## Opening setup

1. Continue as the demo user. Connect Nexi and at least Danske Bank through the labelled demo connection.
2. Choose “Talk with Penny about your plan.” Tap to talk, or use the explicitly labelled text chat.
3. Tell Penny the income, budgets, buffer, risk comfort and savings goal. Penny asks for missing information one question at a time and returns a full plan card.
4. Review and press “Save my plan.” These settings persist in the shared browser store and are used by later agents. The app opens Penny on Home.

Rehearsed synthetic setup: take-home pay 32,000 kr/month; groceries 3,500; eating out 1,500; transport 1,000; shopping 1,200; subscriptions 600; entertainment 900. Three-month buffer, cautious risk, family bike 20,000 kr by 1 June 2027. These values are a test scenario, not required user defaults.

## The main demo

1. Home is Penny, rather than a finance dashboard. Ask “How is our grocery budget doing?” She uses the stored plan and displays the matching category budget card.
2. Open Demo events and choose Budget update. The in-app notification stack appears.
3. Tap the update. Penny opens with its context, explains the current spending and displays its computed budget card.
4. Ask a follow-up about savings progress, cash until payday or a proposed action. Show the relevant artifact rather than navigating through financial dashboards.
5. Changes appear as confirmation cards. A simulated transfer or settings change requires explicit confirmation and persists its result for the next conversation.

A Nexi receipt event can also appear in the stack, but it is an explicitly simulated notification. It currently adds no expense or allocation. Shared Nexi receipt classification and bank-payment allocation are still unfinished. Do not claim that this notification processed a real receipt or changed the budget.

## Verified candidate

On 21 October 2026, the real browser text path connected Nexi and Danske, sent the full synthetic plan to Haiku, rendered the settings card and saved it. The shared store showed onboarding complete and all chosen values at revision 12. A demo budget notification then opened a contextual Haiku reply and grocery artifact using the new 3,500 kr limit. The user separately confirmed audible GPT-Live voice and a matching budget card on localhost3001.

Production builds passed for web and Penny after the Live transport correction, per the build owner. The status thread independently passed 26 focused notification/store/tool/chat tests. Phone behavior, complete spoken onboarding, sustained voice recovery, deployment and the combined Nexi allocation flow are not established by these checks.

Keep the labelled text chat as the live fallback. A local URL is for rehearsal, not a published audience link. Pitch claims must match these demonstrated behaviors and limits.
