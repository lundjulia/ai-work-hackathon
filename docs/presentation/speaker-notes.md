---
provenance: Unvetted Synthetic
---

# Penny presentation

Two minutes of pitch plus a one-minute demo. Total: three minutes. Slides 1–3 take 70 seconds, slide 4 is the 60-second demo, and slides 5–6 take 50 seconds.

Open [the deck](http://localhost:3001/pitch/index.html). Arrow keys change slides. F enters fullscreen, ? opens controls. Keep the [app](http://localhost:3001) ready in a second tab. Local links require the dev server; they are not public audience URLs. An offline HTML copy and editable PowerPoint accompany these notes.

## Slide 1 · Problem · 0:00–0:20

"For a busy family, money is another job after work. Receipts, bank accounts and bills are scattered, and it's hard to know what's left. That can mean stress at the end of the month. We built Penny to help parents feel in control, without having to study personal finance."

## Slide 2 · Why it matters · 0:20–0:40

"In the S&P Global survey, only 33 percent of adults worldwide met the financial-literacy threshold. That's a global finding from 2014, not a Danish statistic. But it raises a useful question: how can AI help people understand everyday money decisions?"

## Slide 3 · Product · 0:40–1:10

"Penny is a friendly AI money coach. You set your family's budget, safety buffer and savings goal, then talk to her in your own words. Claude explains the numbers, and calculated cards let you check the answer. You confirm changes. We start with groceries, with bank and loan insights as the broader direction. Our aim is to let Penny check the finances and contact you when something needs attention. Let us show you."

## Slide 4 · Demo · 1:10–2:10

Before presenting, sign in, connect the labelled synthetic bank fixtures and save the family plan. Use the browser where the voice and card were verified. Do not spend this minute on onboarding. Check microphone and audio beforehand. Keep the labelled text chat ready.

- 0–8 seconds: switch to the app. Say, "This prototype uses synthetic bank data and simulated connections. No real money moves."
- 8–28 seconds: tap Talk to Penny and ask, "How is our grocery budget doing?" Let the answer finish. Point to the matching budget card. Avoid quoting a fixed balance; the card uses current saved state.
- 28–48 seconds: use Demo events → Budget update, then open the notification. Show that Penny uses the saved family budget and the event's context.
- 48–60 seconds: say, "One question gives the family an understandable answer and the numbers behind it." Switch back to slide 5.

If voice does not respond within roughly eight seconds, use the text field with the same question. If a provider request fails, show the existing card or actual-app screenshot and say that the live request failed. Do not present a screenshot as a fresh answer. End the demo at 60 seconds.

## Slide 5 · Outcome · 2:10–2:30

"The outcome we want is less stress, clearer spending decisions and progress toward something the family cares about. Tonight we demonstrated conversation, saved plans and contextual budget cards. We haven't proved that families save money or feel less stressed yet. That's the next test."

## Slide 6 · Next step · 2:30–3:00

"Julia owns our next 30 days. We'll test Penny with five Danish families: set a grocery budget, try simulated receipts and explore a savings goal. We'll check what they understand, what helps, and what confuses them. Our target is at least three families saying they would use Penny regularly, backed by examples of useful features. We're looking for pilot families and a technical partner to move beyond simulated receipts."

## Questions to be ready for

- Does it tell families what to invest in? This pitch covers budgets and possible savings. The family chooses what to do with its money. Loan comparisons are sample scenarios, not validated personal financial advice.
- Are bank and Nexi connections real? No. Synthetic bank fixtures and simulated connections. Shared Nexi receipt classification and bank-payment allocation are unfinished. A receipt event in the main app does not change its budget.
- Does it work while the app is closed? No. The current local prototype runs reviews while open. Background checks and cross-device sync need further implementation.
- What AI is real? Claude Haiku handles financial conversation and daily review. Azure GPT-Live handles audio. Voice with a matching card was user-verified; saved onboarding and contextual budget notifications were browser-verified. The separate Penny receipt app uses different state and is not a combined pipeline.
- What does 33% mean? The 2014 S&P Global FinLit Survey classified an adult as financially literate when they correctly answered at least three of four concepts: diversification, inflation, numeracy and compound interest. The report was published in 2015 and interviewed over 150,000 adults in more than 140 countries. It is not current Danish prevalence or evidence of demand for Penny.

## Sources and claim boundaries

- [Latest Problem + Idea Google Doc](https://docs.google.com/document/d/1c3nieExbHYsZclCYt0nbJxO-dADehgvwg7vWb-QFu2M/edit), modified 21 October 2026 at 19:36 Copenhagen, read through Drive text export. Contains the family problem, Penny concept, Julia's ownership and the five-family/three-family pilot target.
- [S&P Global FinLit Survey report](https://gflec.org/wp-content/uploads/2015/11/3313-Finlit_Report_FINAL-5.11.16.pdf), primary report accessed 21 October 2026. [Research project page](https://gflec.org/initiatives/sp-global-finlit-survey/).
- [Intro transcript](../intro.md) and [event guidance](../event-instructions.md): name whom the project helps, demonstrate the prototype, and give a 30-day plan with an owner, first real-world test and support needed. The Google Doc selects The person path. Household money administration connects the story to everyday work; no job-reskilling outcome is claimed.
- Main T3 thread `9007705f-0ea3-4950-ac3f-35f3caa98feb`, read through final handoff at position 547. [PRD](../../PRD.md), [status](../../status.md) and [demo evidence](../demo-script.md) establish the combined direction and candidate limits.
- [Design baseline](../design.md): forest green, mustard mascot and family framing. Slide 4 uses an actual local screenshot captured during this task.

No measured household outcomes or real savings are claimed. The 3-of-5 target is a proposed pilot threshold, not a result or representative market validation.
