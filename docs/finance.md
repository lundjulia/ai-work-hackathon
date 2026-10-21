---
provenance: Unvetted Synthetic
---

# Finance core

`packages/finance` is a pure TypeScript domain package. The import boundary contains provider-shaped synthetic connectors; deterministic code computes the values used by the UI, daily agent and voice tools. No bank has been connected and no payment can be initiated here. The product scope is in [PRD.md](../PRD.md), with API coverage in [open-banking-data-support.md](open-banking-data-support.md).

## Consumer API

```ts
import { loadDemoDataset, getSnapshot, proposeGoals, generateForecast } from '@claude-impact-lab/finance';
const dataset = await loadDemoDataset('2026-10-21');
const goals = proposeGoals(dataset);
const snapshot = getSnapshot(dataset, goals);
const forecast = generateForecast(dataset, goals, 60);
```

Consumers must filter the dataset to the accounts and providers actually connected in app state before calling these functions. `getSnapshot` and `proposeGoals` are synchronous and do not mutate input. The fixture loader is asynchronous because it uses the same connector interface as a later live loader. It rejects dates after the generated activity ends on November 2, so a later refresh cannot pretend to have complete bank activity. Forward forecasts may still estimate later days.

- `transactions` contains reconciled, categorized records with signed `amountDkk`, `isInternalTransfer`, optional pending replacement IDs and `valuationMissing`. A missing FX conversion has `amountDkk: 0` plus the explicit missing flag and warning; it is not a zero-value purchase.
- `totals` contains `cashDkk`, `investmentsDkk`, `totalDkk` and `complete`. Cash includes Saxo cash; investments means positions. Saxo total value already includes cash, so it is split once. If only total value is supplied, the known value remains under investments, the result is incomplete and the warning names the absent split.
- `budgets` contains category, net spent, budget, remaining, `pace` as spent/budget, days left and a linear full-month projection. Reservations count once; refunds reduce spend. The projection is an estimate, not a scheduled debit.
- `recurring` is an array of inferred monthly salary, bills and subscriptions. At least two monthly occurrences are required. It preserves account, day of month, weekend adjustment, amount and observed subscription changes. `inferRecurring` and `recurringDate` are also exported.
- `forecast` contains current available everyday cash, nullable next salary and days to salary, nullable projected cash at that salary, minimum balance, estimated bills, daily rows, horizon end and reliability warnings. Daily rows expose both post-income balance and `beforeIncomeBalanceDkk`, so affordability checks can reserve the low point on salary day. Horizon defaults to next inferred salary or 30 days and is capped at 90 days.
- `safetyNet` contains months covered, historical monthly essential cost, cash buffer, target and gap. Savings cash counts; investment positions do not. A shared savings account is one pool: a trip target and emergency target cannot both claim separate ownership of its entire balance.
- `surplus` contains a proposed DKK transfer amount, source and destination. It reserves the minimum forecast cash before salary, limits the amount to the source's available cash, rounds down to DKK 100, and requires fresh connected DKK current and savings accounts. Missing/stale everyday data or unknown salary blocks the suggestion.
- `risk` contains position value, equity percentage, largest single-company position, domestic-equity share, cost-basis gain/loss and tolerance. Percentages use 0–100. A broad equity ETF is not a single-company exposure. Cost-basis loss is not historical peak drawdown.
- `candidates` contains stable finding keys and computed facts. The LLM may select and explain these candidates; it must not invent amounts, imply that synthetic rates are live offers, or execute payments.

## Reconciliation and estimates

Retrievals replace transaction IDs and account/instrument valuations rather than add them. A booked purchase can replace one matching reservation with a new ID within seven days. Two distinct booked IDs remain separate and can produce a possible-duplicate alert. Transfer matching requires an opposite connected-account leg plus a transfer hint, account identifier, Revolut top-up or common FX exchange ID. A similar amount alone is insufficient. Unmatched transfers remain transfers but are not claimed as confirmed internal movements.

Rules use merchant, counterparty and raw description before MCC. Unknown merchants and ambiguous person-to-person payments remain uncategorized. Original foreign amounts remain on the record. Conversion uses the account's booked amount and latest non-future dataset FX rate. EUR currency accounts are distinct even when their IBAN matches.

Auto budgets use up to three completed calendar months, excluding partial imported history and the current month. Restaurants receive a 10% reduction rounded to DKK 100; other variable categories use the observed average. Subscriptions use inferred monthly amounts. Salary is inferred from repeated salary records. A named future savings goal is a user preference, so `proposeGoals` does not invent one.

Forecasts reserve the greater of historic or accepted flexible spending, inferred monthly bills and regular transfers outside everyday accounts. Available balances already include reservations; booked-only balances receive one reserve. Future income is apportioned across inferred salary streams rather than adding the full monthly goal to each salary. Dates account for weekends; Danish public holidays are not modeled. This is an estimated aggregate everyday-cash forecast, not a per-account solvency guarantee or a complete scheduled-payment feed.

Finding keys persist across daily runs. Budget near/over keys differ by month, category and threshold; duplicate keys identify the account/day/merchant/amount cluster; subscription keys identify the old/new amount; refinancing keys identify liability/bond/quote date; risk keys identify account/tolerance/company; safety-net keys identify account/target settings. Surplus keys include month and amount to prevent approval of a stale larger quote. Feedback may suppress the transfer family for that source/destination/month while approval must revalidate the exact current candidate.

## Financing assumptions and source check

Source checks were performed on 21 October 2026. They verify general rules and current registration rates, not a live loan quote or a user's tax position.

- [Skattestyrelsen's interest-deduction guide](https://skat.dk/borger/fradrag/fradrag-for-renter) confirms that bank and mortgage interest is generally reported automatically, and that changed loans require checking the preliminary tax assessment. It does not give a universal personal tax-relief rate. The calculator assumes 25% marginal relief on interest and mortgage contribution, and no relief on principal or setup fees. Contribution treatment and the user's exact relief require confirmation.
- [The ministry's 2026 registration table](https://svmn.dk/tal-og-metode/satser/satser-og-beloebsgraenser-i-lovgivningen/tinglysningsafgiftsloven) lists real-property mortgage registration at 1.25% plus DKK 1,825. [Skattestyrelsen's registration guide](https://skat.dk/erhverv/afgifter-paa-varer-og-ydelser-punktafgifter/tinglysningsafgift) says the percentage calculation rounds upward to DKK 100. The calculator assumes previously registered pledge can offset the variable basis; actual reuse eligibility is a lender/legal check.
- [Realkredit Danmark's fixed-rate loan overview](https://rd.dk/laantyper/obligationslaan) confirms fixed-rate products and possible refinancing to higher/lower rates. The scenario assumes redemption at par on a permitted settlement date, or the entered price if lower. Notice periods, accrued/difference interest, bond trading spread and settlement-day restrictions are not modeled.

Mortgage scenarios finance DKK 12,000 lender/settlement fees, the registration fee and the quote's bond-price loss. The comparison retains the existing remaining term and checks cumulative after-tax payments plus remaining debt. A candidate requires break-even within 60 months. The synthetic 4% quote at price 98.4 on October 26 implies DKK 53,074.19 additional debt, DKK 648.25 first-month saving after assumed tax relief and break-even at 40 months. The earlier price 96.6 takes 83 months and does not pass the rule. This is a lower-rate conversion, `nedkonvertering`.

Consumer-loan comparison assumes 7.9% nominal annual interest, DKK 1,000 financed setup cost, the same remaining term and 25% interest relief. It saves DKK 5,159.14 over the fictional 48-month loan. The rate and fees are invented; ÅOP, affordability and approval need a lender quote. The liability record is user-entered, not sourced from open banking.

## Verified behavior and remaining gaps

Run `node --test packages/finance/test/finance.test.ts` with Node 24 and `./node_modules/.bin/tsc --project packages/finance/tsconfig.json --noEmit` after root dependencies are present. Tests cover unfamiliar merchants and salary schedules, FX and missing FX, transfers, refunds, pending replacement, duplicate charges, future filtering, deterministic retrieval and IDs, completed-month proposals, salary-day low points, consent fallback, forecast-safe surplus, portfolio split and equal-term loan math.

At the October 19 demo date, cash is DKK 52,744.57, positions DKK 95,000 and total DKK 147,744.57. Restaurant spend is DKK 1,191. October 21 adds the Bæst meal and reaches DKK 2,145 of the DKK 2,500 budget with 10 days left. October 22 reveals the two DKK 1,299 Elgiganten charges. October 23 reveals Netflix's DKK 20 monthly increase. October 26 adds the refinancing candidate. October 30 restaurant spend is DKK 2,587 and a DKK 4,400 transfer is suggested with the example accepted goals.

Live connector authentication, market quotes, full transaction enrichment, public-holiday scheduling, lender underwriting, precise personal tax outcomes and historical portfolio peak drawdown remain outside this demo engine. Prices are frozen synthetic valuations and warn when old. An unavailable connector preserves last-good records with stale status where available; it does not silently become a zero balance. Main owns UI/API integration and runtime verification.
