---
provenance: Unvetted Synthetic
---

# Open Banking data support for Danske Bank, Saxo, and Revolut

Scope: Danish personal accounts. Research date: 21 October 2026.

This document compares the banks' documented APIs. No aggregation provider has been selected, and no customer accounts have been connected. "Documented" means the bank publishes an endpoint or data field. It does not mean every Danish account returns it or every aggregator passes it through.

For demo planning, see [Fetchable financial data and demo mocks](demo-data-availability.md), which separates source data, app-derived outputs, missing datasets, and proposed fixtures.

## What we can access

Danske Bank and Revolut support account information services through their Open Banking APIs. These provide payment-account details, balances, and transactions with customer consent. Saxo's OpenAPI provides investment-account data, including cash, holdings, portfolio values, trades, and performance. Using that OpenAPI requires its own integration and live-application access. [D1, D2, R1, R2, S1, S7]

For an app that combines everyday finances and investments, plan for an Open Banking connection to Danske Bank and Revolut, plus a Saxo OpenAPI connection. A provider's claim to "support Saxo" needs confirmation of the actual investment data supplied.

### Enable Banking as a candidate provider

Enable Banking's live catalog, checked on 21 October 2026, lists Danish personal account connections for Danske Bank and Revolut as non-beta, and Saxo Bank as beta. This establishes advertised account-information connectivity, not successful retrieval from these customer accounts or investment-data coverage through Saxo's beta connector. [E1]

Its restricted production mode allows an individual to link their own accounts and then retrieve data from those linked accounts. Linking activates the application; the app must still perform its API authorization flow. Its current terms make API use within their scope free, including personal use by private individuals and evaluation, with possible linked-account limits. Other use requires a separate agreement. This is a candidate access path, not a final provider selection or a claim of unrestricted commercial use. [E2, E3]

| Data | Danske Bank PSD2 | Revolut Open Banking | Saxo OpenAPI |
| --- | --- | --- | --- |
| Account list and identifiers | Documented | Documented | Documented for investment accounts |
| Currency and account metadata | Documented | Documented | Documented |
| Cash balance | Documented, with balance type and timestamp | Documented, with balance type and timestamp | Documented, separate from portfolio value |
| Payment-account transactions | Documented | Documented | Investment-account cash movements and trades |
| Pending transactions | Status supported in schema; Danish population needs testing | Documented, including a pending card-payment example | Intraday transactions may be incomplete until settlement |
| Counterparty and payment description | Optional fields | Optional fields | Transaction type, event, bookings, and trade details |
| Merchant name | Optional field | Optional field with card-payment example | No retail-spending feed established |
| Merchant category code | Optional field | Absent from the examined merchant-details schema | No retail-spending feed established |
| Saved beneficiaries | Endpoint documented | Endpoint documented | No equivalent retail feature established |
| Standing orders | Endpoint documented | Endpoint documented | No equivalent retail feature established |
| Scheduled-payment list | Endpoint documented | No dedicated account-level read endpoint in examined specification | No equivalent retail feature established |
| Direct-debit agreement list | No dedicated endpoint in examined PSD2 specification | Endpoint documented | No equivalent retail feature established |
| Securities holdings and quantities | No holdings endpoint in examined PSD2 API | No holdings endpoint in examined Open Banking API | Documented through positions and net positions |
| Investment valuation and profit/loss | No portfolio endpoint in examined PSD2 API | No portfolio endpoint in examined Open Banking API | Documented |
| Historical trades, dividends, and investment fees | No structured investment history in examined PSD2 API | No structured investment history in examined Open Banking API | Documented through historical transactions |
| Historical investment performance | No endpoint in examined PSD2 API | No endpoint in examined Open Banking API | Documented |
| Mortgage, pension, or crypto portfolio | Not established by this PSD2 API | Not established by this Open Banking API | Do not infer coverage beyond the client's accessible Saxo accounts and instruments |

Sources for the table: Danske's production PSD2 specification and FAQ [D2, D3]; Revolut's official OpenAPI specification [R2]; Saxo's portfolio, transactions, performance, and reporting documentation [S1–S6]. Optional fields can be absent even when the endpoint succeeds.

## Danske Bank

### Accounts and balances

Danske's FAQ states that its PSD2 APIs cover private and business **payment accounts**. For this scope, that establishes private payment-account coverage. Its separate list of UK current accounts, savings accounts, and credit cards does not establish Danish product coverage. [D3]

The production Account and Transaction API is version 4.0.0 at the research date. Its base URL is `https://psd2-api.danskebank.com/psd2/v4.0/aisp`. [D1, D2]

| Read endpoint | Documented data |
| --- | --- |
| `GET /accounts` and `GET /accounts/{AccountId}` | Account ID, currency, status, account category and type code, description, nickname, account identifiers and name. Other schema fields include opening and maturity dates and servicing-bank information. Many fields are optional. |
| `GET /accounts/{AccountId}/balances` | Account ID, amount, currency, debit/credit indicator, balance type, timestamp. Optional credit-line and local-currency amounts. |

The identifier schema includes IBAN and `DK.DanskeBank.AccountNumber`. Treat these as identification schemes the response can use, rather than requiring every account to return both. An account name is not a full identity or KYC record. [D2]

### Transactions and future payments

`GET /accounts/{AccountId}/transactions` supports these fields: [D2]

- Core transaction fields: account ID, amount and currency, debit/credit direction, booking timestamp, and status.
- Optional identifiers and context: transaction ID, reference, statement references, value timestamp, and transaction information.
- Optional detail: creditor and debtor names and account identifiers, bank transaction codes, charges, exchange-rate information, and balance after the transaction.
- Optional card detail: merchant name, merchant category code, and card instrument information. Do not expect full card credentials.

Version 4 uses transaction status codes such as `BOOK` and `PDNG`, and balance codes such as `ITAV` and `ITBD`. Translate these explicitly if the app needs readable labels. Do not assume Revolut's string values apply to Danske. The pending-status schema alone does not prove complete coverage of Danish card reservations. [D2]

Danske also documents account-level read endpoints for `beneficiaries`, `scheduled-payments`, and `standing-orders`, with corresponding consent permissions. Its examined PSD2 specification has no dedicated `direct-debits` endpoint. Do not promise a complete Betalingsservice agreement list from those other endpoints. Completed debits may still appear in transaction history. [D2]

### History and refresh limits

Danske's FAQ documents: [D3]

- Up to **25 months** of transaction history directly after consent creation or with separate customer authorization.
- **90 days** of transaction history for later retrieval when the customer is absent.
- A PSD2 strong customer authentication validity window of **180 days**. This is distinct from the transaction-history window and any consent expiry or revocation.
- A hard limit of **25 requests per second per AIS API per third-party application**. This does not establish permission for unlimited background refreshes. Confirm the background-access allowance with the chosen provider.

Fetch the requested historical range during authorization. Ongoing retrieval can then maintain the app's own history, subject to its consent and retention policy. Danske marks transactions as mutable because back-valued transactions can change historical balances, so reconciliation must allow updates to previously imported records. [D2]

Danske's Premium Account Transaction & Balance API is a separate product. Its documentation and historical limits should not be substituted for the PSD2 API described here.

## Revolut

### Danish eligibility and account data

Revolut's regional access matrix covers EEA customers under eIDAS certificates and includes Revolut Bank UAB for EEA countries not listed as a specific branch. Denmark falls within that EEA coverage. Confirm the customer's actual Revolut entity during provider selection. [R3]

The examined Open Banking specification is version 3.1.0, with production base URL `https://oba-auth.revolut.com`. [R2]

| Read endpoint | Documented data |
| --- | --- |
| `GET /accounts` and `GET /accounts/{AccountId}` | Account ID, currency, personal/business account type, account subtype, optional nickname, and identification details including account name. |
| `GET /accounts/{AccountId}/balances` | Account ID, amount, currency, debit/credit indicator, balance type, and timestamp. The published example uses `InterimAvailable`. |
| `GET /accounts/{AccountId}/transactions` | Amount and currency, debit/credit direction, status, booking timestamp, and optional transaction detail below. |

The account examples include a UK current account and a savings account. They do **not** prove Danish coverage of every savings product, Pocket, Joint account, or currency balance. Check which accounts the customer's Danish connection actually exposes. Revolut's currency field supports distinguishing currency accounts where one account number covers multiple currencies; do not use IBAN alone as the app's account key. [R2]

### Transaction detail and other read endpoints

The transaction schema and examples document: [R2]

- Transaction ID, description, booking and value timestamps, and `Booked` or `Pending` status.
- Optional creditor and debtor account details for transfers.
- Optional foreign-exchange detail, including source and target currencies, instructed amount, and exchange rate.
- Optional charges, transaction balance, proprietary transaction type, and supplementary data such as user comments.
- Optional merchant name and limited card instrument detail. The card-payment example includes the card's last four digits, scheme, and name.

The examined merchant-details schema contains `MerchantName`, but no `MerchantCategoryCode`. Spending categories, merchant enrichment, subscription detection, and recurring-income labels therefore require a provider enrichment service or app logic unless an actual connection supplies additional data.

Account-level beneficiaries, direct debits, and standing orders have documented read endpoints. The consent permission list also includes scheduled-payment permissions, but the examined specification has no dedicated `GET /accounts/{AccountId}/scheduled-payments` endpoint. Payment-initiation endpoints for scheduled payments do not establish a complete read feed of existing scheduled payments. [R2]

### Authorization window and history

Revolut documents a **five-minute window after the user authorizes consent**: [R2]

- Full available transaction history is accessible during that window, subject to the requested consent range and actual available records. The examined source does not give a fixed maximum number of historical months.
- Afterwards, the transaction endpoint returns only the preceding **90 days**.
- Afterwards, background transaction retrieval should not exceed **four requests per account per 24 hours**, unless the user is present and actively requesting data. Pagination and provider scheduling need to respect the applicable allowance.
- The individual-account detail, beneficiaries, direct-debit, and standing-order endpoints return **403** outside that five-minute window.

The five-minute restriction on `GET /accounts/{AccountId}` should not be generalized to the account-list and balance endpoints, whose examined descriptions do not state the same restriction. Treat reconnecting, consent expiry, and a rolling history window as separate conditions.

Revolut Open Banking does not document structured stock holdings, crypto balances, investment cost basis, or portfolio performance in the examined account-information API. A transfer to an investment or crypto product in payment history does not reveal the current value of that product. Revolut Business, Merchant, and crypto APIs are separate products and do not establish access to a Danish personal customer's whole Revolut portfolio. [R1, R2]

## Saxo Bank

### Separate investment API

Saxo's OpenAPI is a portfolio and trading API. This research establishes investment-data support through OpenAPI. Enable Banking separately lists a beta Danish Saxo connector, but its holdings, performance, account-type and field coverage remain unverified. Confirm that connector's data contract separately. [S1, S7, E1]

| Endpoint or resource | Documented data |
| --- | --- |
| `GET /port/v1/accounts` | Investment accounts, account ID and key, currency, account type, active status, and account settings. |
| `GET /port/v1/balances` | Cash balance, total account value, position values, unrealized profit/loss, margin usage and availability, and collateral data where relevant. |
| `GET /port/v1/positions` and `GET /port/v1/netpositions` | Individual positions and aggregated positions by instrument, with position detail, current valuation and profit/loss through the requested field groups. |
| `GET /port/v1/orders` | Active investment orders. These are trading orders, not recurring bank payments. |
| `GET /hist/v1/transactions` | Historical trades and cash movements, corporate actions, dividends, fees, interest, deposits, and withdrawals. |
| `GET /hist/v4/performance/timeseries` and `/summary` | Historical account/client performance, account values, balances, returns, profit/loss, and trading metrics according to field groups. |
| Client Reporting resources | Account statements in PDF/Excel and portfolio reports in PDF. |

Sources: [S1–S6, S8]. The paths above are relative to the Saxo OpenAPI base URL for the selected environment. Account access and field availability depend on the authorized identity and account settings.

Historical transactions can contain instrument information, quantities, trade prices, booked cash amounts, costs, exchange rates, realized profit/loss, and booking/trade identifiers. Corporate actions can combine cash and securities movements. These support an investment ledger, rather than just a list of bank payments. [S3, S8]

### Coverage limits

- `GET /port/v1/closedpositions` contains intraday closed positions for real-time netting clients. Saxo removes them after daily settlement. Use historical transactions and reporting for older activity. [S1]
- Intraday historical transactions may lack identifiers and other details until netting, booking, and settlement finish. Reconcile them after settlement. [S3]
- Portfolio price and profit/loss values reflect the user's exchange-data subscriptions. Do not promise universal real-time market prices. [S1]
- Performance is calculated during end-of-day processing on days when the market is open. It is not a continuously calculated performance history. [S4]
- The reviewed sources do not establish a universal historical retention limit or access to every Danish account wrapper, including an aktiesparekonto or pension account. Confirm those against the customer's accessible account list.
- Statements and transaction detail do not establish a complete Danish tax-return dataset. The account statement documents posting date, value date, product detail, net change, and cash balance. [S6]

Saxo allows simulation development, but live applications require an access application and may require review. Its personal-use route is for direct retail/professional clients with a funded live account and use within their own person or entity. An app serving other customers needs the appropriate Saxo relationship and approval. User authorization uses Saxo's own OAuth flow. [S7, S9]

## Implications for the app

An everyday spending dashboard can use Danske Bank and Revolut accounts, balances, and transactions. A combined cash-and-investments view needs Saxo's portfolio data as well. It remains incomplete for assets and liabilities that these connections do not expose.

Store original currency amounts, balance types, source account IDs, transaction status, and retrieval timestamps. Keep provider-specific fields alongside any normalized data. Missing optional fields mean "not supplied", rather than zero or an empty financial position. Avoid adding Saxo's cash balance to its total account value, which already represents the account's overall value. Match transfers between connected accounts so they do not become duplicate income or spending.

Before selecting an aggregation provider, obtain evidence for:

1. A working Danske Bank Denmark personal connection and a Revolut EEA connection for Danish residents.
2. The actual account types and currencies exposed, including any savings or joint accounts needed by the product.
3. Historical depth at connection, later refresh limits, reconnection behavior, and pagination.
4. Population of merchant, counterparty, pending-transaction, scheduled-payment, and direct-debit fields.
5. Saxo live access for the intended users and investment account types, or a provider that explicitly supplies those investment datasets.

Direct production access to Danske and Revolut requires third-party-provider onboarding, certificates, and customer authorization. A customer's consent alone is not a substitute for those access requirements. A regulated aggregation provider is an alternative to direct bank onboarding; confirm its contractual and regulatory integration model. [D1, D4, R4]

## Sources and verification

The research checked official documentation and parsed Danske and Revolut's published API schemas. It did not authenticate to production accounts. Some Revolut reference pages rejected direct requests; the bank's official GitHub specification supplied the endpoint definitions, examples, and access-window wording. The source date above records agent research, not human curation.

| Ref | Official source | Used for |
| --- | --- | --- |
| D1 | [Danske Account and Transaction PSD2 overview](https://developers.danskebank.com/regulatory-apis/0a8d07f2-9ae2-196e-819a-e33aa43a0005) | API version, consent, certificates, and access model |
| D2 | [Danske production PSD2 specification](https://developers-gw.danskebank.com/v1/integration-catalog/gateway/integrations/0a8d07f2-9ae2-196e-819a-e33aa43a0005/documents/specification), also available through the [reference page](https://developers.danskebank.com/regulatory-apis/0a8d07f2-9ae2-196e-819a-e33aa43a0005/reference) | Exact endpoints, fields, consent permissions, status codes, and mutability |
| D3 | [Danske regulatory API FAQ](https://developers.danskebank.com/regulatory-apis/faq) | Private payment-account coverage, 25-month/90-day history, 180-day SCA window, and rate ceiling |
| D4 | [Danske API authorization](https://developers.danskebank.com/regulatory-apis/api-authorization) | Consent and token flow |
| R1 | [Revolut Open Banking introduction](https://developer.revolut.com/docs/guides/build-banking-apps/introduction-to-the-open-banking-api/introduction) | Product scope |
| R2 | [Revolut official Open Banking specification](https://github.com/revolut-engineering/revolut-openapi/blob/master/json/open-banking.json) | Endpoints, schemas, examples, permissions, five-minute restrictions, history, and refresh allowance |
| R3 | [Revolut global customer access controls](https://developer.revolut.com/docs/guides/build-banking-apps/introduction-to-the-open-banking-api/global-customer-access-controls) | EEA entities and certificate requirements |
| R4 | [Who can access Revolut's API](https://developer.revolut.com/docs/guides/build-banking-apps/introduction-to-the-open-banking-api/who-can-access-the-api) | Regulated-provider access and production onboarding |
| S1 | [Saxo portfolio overview](https://www.developer.saxo/openapi/learn/portfolio) | Accounts, balances, positions, orders, streaming, and closed-position limits |
| S2 | [Saxo account details](https://www.developer.saxo/openapi/learn/account-details) | Account and cash/valuation fields |
| S3 | [Saxo transactions](https://www.developer.saxo/openapi/learn/transactions) | Trades, bookings, corporate actions, fees, and settlement caveats |
| S4 | [Saxo performance](https://www.developer.saxo/openapi/learn/performance) | Performance endpoints and calculation timing |
| S5 | [Saxo Client Reporting](https://www.developer.saxo/openapi/learn/client-reporting) | PDF and spreadsheet reports |
| S6 | [Saxo account statement](https://www.developer.saxo/openapi/learn/account-statement) | Statement fields and formats |
| S7 | [Writing a Saxo OpenAPI application](https://www.developer.saxo/openapi/learn/writing-an-openapi-application) | Simulation, live approval, and personal versus other-customer use |
| S8 | [Saxo historical transactions reference](https://www.developer.saxo/openapi/referencedocs/hist/v1/transactions) | Historical endpoint and filters |
| S9 | [Saxo authorization code grant with PKCE](https://www.developer.saxo/openapi/learn/oauth-authorization-code-grant-pkce) | User authorization and token flow |
| E1 | [Enable Banking live bank catalog](https://enablebanking.com/api/aspsps) | Danish personal connectors; Danske/Revolut non-beta and Saxo beta status |
| E2 | [Enable Banking own-account activation](https://enablebanking.com/docs/api/linked-accounts/) | Restricted production access, linked accounts and separate API authorization |
| E3 | [Enable Banking terms](https://enablebanking.com/terms/) | Free use within the terms' personal/evaluation scope and restrictions on other use; checked in the published application bundle |

