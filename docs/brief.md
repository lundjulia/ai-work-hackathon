# Original brief (verbatim from developer)

Technical implementation:
- Demo user sign in
- Syncs with Nexi Smart Receipt (Fake this part! See what the api supports)
- Data in JSON live from the app, assume that integration is possible
- Add a "Connect with Nexi" button and just assume that the flow works
- Meal planning? Check tilbudsaviser newspapers to see if they saved money by shopping there. Can we track Netto, Bilka, Føtex, Rema, and Lidl, find cheapest meals (in amount/kg; not by count)
- Should work on mobile using PWA

Problem: Families lose track of their household budget and feel stressed at the end of the month.

User story: As a parent managing a busy household, I want to see at a glance where our money goes and what's left, so I can save for something specific or start investing.

Target group: Families with children who want control over everyday finances without having to study personal finance.

Our goal: We want to give families clear, calm control over their household budget, so they can set money aside for something that matters, like a trip, a home or investing.

Outcome we're aiming for: Less stress, fewer arguments about money, and a real feeling of progress toward a goal.

Why it matters: Only 33% of adults globally are financially literate (S&P Global). We want to make money feel manageable for the other 67%.

Role of AI: Receipts flow in automatically from the Nexi Smart Receipt app, so there is no manual entry. We use AI to categorize them, explain in plain language where the money went, and show how much we can save, without ever judging.

Our demo: A food budget tracker, shown as the first category of a broader household budget, with a savings goal on top.

One thing to be ready for: if someone asks whether the AI tells people what to invest in, the answer should be no. It shows what's possible to save, and the family decides what to do with it.

## How it works in practice
- Connect: We link the family's Nexi Smart Receipt app once. Every receipt then flows in automatically, with no manual entry.
- Set a goal: The family picks something specific to save for (a trip, a home, investing) and sets a monthly amount.
- AI sorts: AI reads each receipt, categorizes it (food, transport, home, etc.) and updates the budget in real time.
- See at a glance: One simple screen shows what we've spent, what's left, and how far we are toward the savings goal.
- AI advisor – Ask for what you want: Use realtime for asking the AI advisor for what you needed in plain language, it will help you understand the details.
- Meet our avatar: A funny, friendly character, in the spirit of Duolingo's owl, guides the family. It is openly an AI, warm and consistent, never judging.
- Smart Notifications: Positive feedback, always: The avatar celebrates small wins: "Under budget three days in a row! The trip is 2 weeks closer." Overspending gets encouragement, not guilt: "Tough week. Here's an easy way to get back on track." Fake a notification screen.
- Simple recommendations: The avatar suggests small, practical moves, like "Swap two takeaway nights for home cooking and save about 300 kr this month."
- Family decides: The avatar shows what's possible. The family chooses what to change and what to do with the savings, including investing.
- Demo flow: Receipt arrives (Done using Nexi (faked)) → AI categorizes it → budget updates → avatar cheers and gives a tip → savings goal moves.
- Why the avatar matters: Money is stressful. A warm character makes families want to come back, which is what builds the habit.

## What's the capability of the AI advisor?
- Define your financial goals (Risk tolerance, Income, set budgets, safety net, savings goal)
- Financial risk management
- Smart alerts of monthly/weekly budget / Auto budget / Insight on your transactions
- Possible user feedback, e.g. "Not spending money on coffee", "No candy this week!"
