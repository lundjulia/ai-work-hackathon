---
provenance: Unvetted Synthetic
---

# Fetchable financial data and demo mocks

Scope: Danish personal accounts at Danske Bank, Revolut, and Saxo Bank. Research checked on 21 October 2026.

Use this guide to decide what a demo can show using realistic fixtures, what the app must calculate, and what needs an additional data source. The [bank API reference](open-banking-data-support.md) contains endpoint details and source links.

## Current evidence

We have checked official documentation, the published Danske and Revolut schemas, and Enable Banking's live bank catalog. We have not connected customer accounts, fetched personal records, implemented an integration, or selected the final provider. No live end-to-end demo is verified.

Enable Banking is a candidate for accounts, balances, and payment transactions. Its catalog lists Danish personal connections for Danske Bank and Revolut as non-beta, and Saxo Bank as beta. A catalog entry confirms advertised integration coverage, not which fields a particular account will return. Saxo's own OpenAPI documents the investment datasets separately.

| Evidence label | Meaning for the demo |
| --- | --- |
| Documented | An API or schema supports the data. A realistic synthetic fixture can represent it, but live delivery is unverified. |
| Optional or conditional | An endpoint, field, or account type depends on consent, bank population, provider support, or account settings. Include missing-data cases. |
| Derived | The app calculates an output from retrieved data. Label estimates and predictions accordingly. |
| Separate source required | The examined connections do not establish access. Use explicitly fictional or manually entered data, or add another integration. |

All mock suggestions below are proposals for demo planning. They do not establish that a mock has been implemented or approved as the final demo behavior.

## Data we can realistically represent

Bank-native schema support and aggregator support are different. Enable Banking's documented core covers account details, balances, and transactions. The bank's additional read endpoints do not automatically become available through that provider.

| Dataset | Danske Bank | Revolut | Saxo | Suggested demo treatment |
| --- | --- | --- | --- | --- |
| Account list, source ID, currency, display name, account identifier | Documented for payment accounts; metadata can be optional | Documented; Danish product and currency-account coverage needs checking | OpenAPI investment accounts documented; aggregator connector is beta | Mock accounts with stable fictional IDs. Leave some metadata absent. |
| Cash balances, balance type, retrieval time | Documented | Documented | OpenAPI cash balance documented | Show the amount, currency, and whether it is booked or available. |
| Transactions: amount, currency, direction, dates, status | Documented | Documented | OpenAPI cash movements and investment transactions documented | Mock ordinary payments and transfers for Danske/Revolut; investment activity for Saxo. |
| Merchant, counterparty, description, reference | Optional fields | Optional fields | Investment event, instrument, booking and trade detail | Some transactions should have only a raw description. |
| Merchant category code | Optional in bank schema; provider population unverified | Absent from examined transaction merchant-details schema | No retail-spending category feed established | Omit when absent. An app spending category is a separate derived field. |
| Pending card payments | Status supported; Danish reservation coverage unverified | Documented, including a card-payment example | Intraday investment records can be incomplete | Mock pending-to-booked transitions without counting the purchase twice. |
| FX information, original amount, charges | Optional | Optional | Documented where applicable to transactions | Include one foreign-currency purchase and preserve its original currency. |
| Beneficiaries and standing orders | Bank read endpoints documented | Bank read endpoints documented | No equivalent retail feed established | Conditional fixture; confirm provider support before planning a live feature. |
| Scheduled-payment list | Bank read endpoint documented | No dedicated account-level list in examined specification | Trading orders are a different dataset | A predicted bill is an app estimate unless an actual payment schedule was retrieved. |
| Direct-debit agreements | No dedicated endpoint in examined PSD2 schema | Bank read endpoint documented, with an access-window restriction | No equivalent retail feed established | A transaction mentioning Betalingsservice does not prove access to its agreement or next amount. |
| Holdings, instrument, quantity, position value, profit/loss | Not established through examined PSD2 API | Not established through examined Open Banking API | Documented through OpenAPI positions and net positions | Use Saxo-style investment fixtures. Do not infer these fields from a generic Saxo bank connector. |
| Trades, dividends, fees, interest, deposits, withdrawals | Payments can reveal cash movements, not a structured investment ledger | Same limitation | OpenAPI historical transactions documented | Mock a purchase, dividend, fee and deposit as separate investment events. |
| Portfolio total value and performance history | Not established | Not established | OpenAPI balances and historical performance documented | Mock values consistent with cash and holdings. Performance history follows end-of-day processing. |
| Statements and portfolio reports | Outside this reference's established coverage | Outside this reference's established coverage | Reporting resources documented in PDF/Excel, depending on report | A generated demo PDF is a sample report, not a bank-issued statement. |

For exact native fields and endpoints, see [Danske Bank](open-banking-data-support.md#danske-bank), [Revolut](open-banking-data-support.md#revolut), and [Saxo Bank](open-banking-data-support.md#saxo-bank).

## What the app can derive

These are plausible demo outputs, not native bank facts. Run the actual calculation or AI step against fixtures if that is what the demo claims to demonstrate.

| Demo output | Required input | What to label or qualify |
| --- | --- | --- |
| Monthly spending by category | Booked transactions, optional merchant information, classification rules or model | Categories are app-generated; ambiguous descriptions can remain unclassified. |
| Recurring subscriptions and salary | Several months of comparable transactions | Detected patterns; the bank has not confirmed a subscription contract or employment. |
| Upcoming bills and cash-flow forecast | Recurrence history, actual schedules if available, current balances | Estimated date and amount. Variable bills can differ. |
| Unusual-spending or duplicate-payment alert | Transaction history and comparison logic | Possible anomaly, not confirmed fraud or a guaranteed duplicate. |
| Cash plus investment overview | Payment-account balances, Saxo total account value, FX rates for conversion | Covers connected accounts. Saxo cash is already included in its total account value. |
| Savings suggestions or financial explanation | Retrieved data plus implemented analysis | Advice or inference. If prewritten, disclose it as scripted demo output. |
| Currency-normalized totals | Original amounts and an explicit FX-rate source or fixture | Identify the rate and valuation time; a fictional rate remains demo data. |

## Data that needs another source

| Desired demo detail | Why the examined feeds are insufficient | Suitable mock or integration |
| --- | --- | --- |
| Receipt line items, products, quantity, VAT, SKU | A card payment normally identifies the payment and merchant, not a shopping basket | A clearly fictional receipt, manual entry, receipt parsing, or a separate receipt service. Nexi payment processing alone does not establish this access. |
| Mortgage or loan principal, rate, repayment schedule | Payment transactions may show instalments but do not establish the loan's outstanding balance or terms | User-entered sample liability or a separate loan-data integration. |
| Pension, property value, assets at other institutions | These connections do not establish complete household asset coverage | Separate source or user-entered fictional values. Avoid claiming complete net worth. |
| Revolut stock or crypto holdings and cost basis | Not established by the examined personal Open Banking API | Explicit investment/crypto sample data or a separately verified integration. |
| Full card number, CVV, PIN | Not financial-dashboard data supplied by these examined feeds | Use a fictional masked card display only. |
| Carbon footprint or exact purchase behavior | Merchant and amount do not identify every product bought | An explicitly modelled estimate or receipt-based analysis. |
| Complete Danish tax position | Investment reports do not establish a full tax-return dataset | A sample calculation with stated assumptions, or another verified source. |

## Proposed demo fixture

Use one fictional Danish person and a fixed demo date. The amounts below are invented fixture targets, not retrieved records.

| Account | Fixture snapshot | Purpose |
| --- | --- | --- |
| Danske everyday account | DKK 18,500 booked cash | Salary, rent, groceries, recurring charges and a transfer to Revolut. |
| Revolut DKK account | DKK 3,200 booked cash | Matching incoming transfer, card purchases, a refund and a pending purchase. |
| Revolut EUR account | EUR 140 booked cash | Foreign-currency balance and FX example; keep separate from DKK. |
| Saxo investment account | DKK 5,000 cash plus DKK 95,000 positions; total DKK 100,000 | Holdings, a trade, dividend, fee, deposit and portfolio history. |

The DKK cash-plus-investments subtotal is DKK 121,700 before EUR conversion. It uses Saxo's DKK 100,000 total once. For transaction history, use 90 days as the fixture's chosen coverage, not as a universal API limit; reconcile the closing balances to opening balances and booked cash movements.

Include these cases so the demo does not depend on perfect bank data:

1. Salary and repeated rent/subscription payments across three months.
2. A DKK 1,000 transfer out of Danske and into Revolut. It should not inflate spending or income.
3. A pending DKK 249 purchase that later books. It should become one purchase, even if the provider changes its identifier.
4. A refund, a transaction without merchant detail, and a foreign-currency purchase.
5. A Saxo dividend with a separate withholding-tax booking and a separate fee. Keep cash and holdings valuations consistent.
6. An expired consent, an unavailable bank, an empty optional field, and a stale balance. Preserve the last retrieval time.

Keep synthetic fixtures at the data-import boundary so downstream calculations can run on them. The app's internal record format should retain source/provider, source account ID, original currency and amount, status, available dates, optional detail, and retrieval time. This is a proposed internal format, not an exact bank response.

Track data origin separately from processing method. A result can be calculated by real app code from synthetic transactions. It can also be a scripted result attached to synthetic transactions. Those are different demo claims.

## Access and history constraints

- Enable Banking's [own-account activation](https://enablebanking.com/docs/api/linked-accounts/) enables restricted production access after linking accounts. Its [current terms](https://enablebanking.com/terms/) make use within their scope free, including personal use by private individuals. This does not grant general access to other users' data or a commercial product. The final demo's use must fit the applicable terms.
- Account linking activates the application but does not replace the app's API authorization flow. Link every intended account, then obtain consent through the integration.
- Danske documents up to 25 months immediately after consent creation or separate authorization, and 90 days for later retrieval with the customer absent. Its 180-day SCA window is a separate limit.
- Revolut documents full available history within five minutes after consent authorization, then a rolling 90-day range. Later background retrieval should not exceed four requests per account per 24 hours. Some additional read endpoints return 403 outside that initial window.
- Saxo's personal OpenAPI live route requires a funded account, a tested simulation application, and a live application request. Its aggregator connector's beta status does not establish holdings or performance coverage.
- Real-time investment prices depend on data subscriptions. Any fixed demo price or FX rate should carry its valuation time.

The [API reference](open-banking-data-support.md#sources-and-verification) contains the source-specific limitations. Recheck them when implementing the chosen provider.

## Demo claims and remaining checks

With fixtures, say: "This demo uses synthetic account data shaped around documented bank APIs. The app calculates these results from that data." If the output is scripted, replace the calculation claim with "The analysis shown is scripted for this demo."

A bank connection mock should read "Demo connection" and should not ask for real banking credentials. A replay of previously retrieved data should show "Recorded data" and its retrieval date. A live label requires an actual successful connection and retrieval.

Before presenting a live feature, record the actual account types, populated fields, history range, missing fields, consent behavior and retrieval time. Demonstrate refresh or recovery as applicable. For a fixture-based demo, verify that calculations use the fixture, that transfers and pending payments are not counted twice, and that every displayed mock or estimate is labelled.

Still unresolved: which connections will be live in the final demo; which Saxo accounts are exposed; whether the provider returns individual credit-card purchases; which optional fields it preserves; and which outputs will run real analysis versus scripted examples. Final mock substitutions remain a demo-scope decision.

Additional primary sources checked for this guide: [Enable Banking live catalog](https://enablebanking.com/api/aspsps), [Denmark authentication notes](https://enablebanking.com/docs/markets/dk/), [API reference](https://enablebanking.com/docs/api/reference/), [own-account activation](https://enablebanking.com/docs/api/linked-accounts/), and [terms](https://enablebanking.com/terms/). The terms page's text was checked in its published application bundle because its initial HTML requires JavaScript. The research date records agent checks, not human curation.
