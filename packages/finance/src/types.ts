/**
 * Normalized finance data model.
 *
 * Every record keeps where it came from (provider, source account ID, original
 * amount and currency, status, dates, retrieval time) so real connectors can
 * replace the fixture connectors without changing downstream calculations.
 *
 * Conventions:
 * - Dates without time are ISO `YYYY-MM-DD` strings (calendar days, Europe/Copenhagen).
 * - Timestamps are ISO 8601 strings in UTC.
 * - `asOf` is a calendar day and means "end of that day": everything booked on
 *   or before it is visible.
 * - Amounts are signed numbers in the account currency: negative = money out.
 */

export type ISODate = string;
export type ISODateTime = string;
export type CurrencyCode = "DKK" | "EUR" | "SEK" | "USD" | (string & {});

export type Provider = "danske_bank" | "revolut" | "saxo";

/** How the data entered the app. A live label requires an actual live retrieval. */
export type DataOrigin = "synthetic_fixture" | "recorded" | "live" | "user_entered";

export interface Money {
  amount: number;
  currency: CurrencyCode;
}

// ---------------------------------------------------------------------------
// Accounts and balances
// ---------------------------------------------------------------------------

export type AccountType = "current" | "savings" | "card" | "investment";

export interface Account {
  /** App-internal stable ID (`<provider>:<sourceAccountId>[:<currency>]`). */
  id: string;
  provider: Provider;
  connectionId: string;
  /** The provider's own account ID. Not an IBAN; Revolut can share one IBAN across currencies. */
  sourceAccountId: string;
  type: AccountType;
  currency: CurrencyCode;
  /** Provider product/display name. */
  name: string;
  /** Optional: often absent in PSD2 responses. */
  nickname?: string;
  /** Optional masked identifier (IBAN or reg/account no.), never a full card number. */
  maskedIdentifier?: string;
  ownerName?: string;
  /** Everyday accounts fund daily spending and receive salary; used for surplus and forecast. */
  isEveryday: boolean;
  origin: DataOrigin;
  retrievedAt: ISODateTime;
}

/**
 * Balance types, mapped from provider codes:
 * - `booked`: Danske ITBD / Revolut ClosingBooked / InterimBooked
 * - `available`: Danske ITAV / Revolut InterimAvailable (booked minus pending reservations)
 * - `investment_cash`: Saxo CashBalance
 * - `investment_positions`: Saxo position value (sum of NetPositions market value)
 * - `investment_total`: Saxo TotalValue (already includes cash; never add cash on top)
 */
export type BalanceType =
  | "booked"
  | "available"
  | "investment_cash"
  | "investment_positions"
  | "investment_total";

export interface Balance {
  accountId: string;
  provider: Provider;
  sourceAccountId: string;
  type: BalanceType;
  amount: number;
  currency: CurrencyCode;
  /** The point in time the provider says the balance refers to. */
  referenceTime: ISODateTime;
  retrievedAt: ISODateTime;
  /** True when this balance comes from an earlier retrieval because the latest one failed. */
  stale?: boolean;
  origin: DataOrigin;
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export type TransactionStatus = "pending" | "booked";

/** Optional provider hint about the transaction's nature. Not a spending category. */
export type TransactionKind =
  | "card_payment"
  | "direct_debit"
  | "transfer"
  | "standing_order"
  | "mobilepay"
  | "salary"
  | "fx_exchange"
  | "refund"
  | "fee"
  | "investment_deposit"
  | "investment_trade"
  | "investment_dividend"
  | "investment_tax"
  | "investment_fee"
  | "other";

export interface Transaction {
  /** App-internal ID: `<provider>:<sourceAccountId>:<sourceTransactionId or derived hash>`. */
  id: string;
  provider: Provider;
  accountId: string;
  sourceAccountId: string;
  /** Optional in Danske's schema; when absent `id` uses a deterministic content hash. */
  sourceTransactionId?: string;
  /** Signed amount in the account currency. Negative = debit. */
  amount: number;
  currency: CurrencyCode;
  /** Original (instructed) amount when it differs from the account currency, e.g. a SEK card purchase. */
  originalAmount?: Money;
  /** Units of account currency per one unit of original currency. */
  exchangeRate?: number;
  status: TransactionStatus;
  /** Booking date. Present for booked transactions. */
  bookingDate?: ISODate;
  valueDate?: ISODate;
  /** Date the purchase/authorisation happened. Always present; used for pending items. */
  transactionDate: ISODate;
  merchantName?: string;
  /** Merchant category code. Optional at Danske; absent from Revolut's schema. */
  mcc?: string;
  counterpartyName?: string;
  counterpartyAccount?: string;
  /** Raw bank description / remittance information. */
  description?: string;
  reference?: string;
  kind?: TransactionKind;
  /** Shared ID linking both legs of an exchange inside one provider (e.g. Revolut DKK->EUR). */
  exchangeGroupId?: string;
  retrievedAt: ISODateTime;
  origin: DataOrigin;
}

// ---------------------------------------------------------------------------
// Investments
// ---------------------------------------------------------------------------

export type AssetClass = "equity" | "equity_fund" | "bond_fund" | "cash";

export interface Instrument {
  symbol: string;
  name: string;
  isin?: string;
  assetClass: AssetClass;
  currency: CurrencyCode;
  /** ISO country of issuer/listing; used for home-bias checks. "GLOBAL" for broad funds. */
  country: string;
  exchange?: string;
}

export interface Holding {
  accountId: string;
  provider: Provider;
  instrument: Instrument;
  quantity: number;
  /** Last price in instrument currency. */
  price: number;
  /** Market value in the account currency (Saxo MarketValueInBaseCurrency). Source of truth for valuation. */
  marketValue: number;
  accountCurrency: CurrencyCode;
  costBasis?: number;
  unrealizedPnl?: number;
  valuationTime: ISODateTime;
  retrievedAt: ISODateTime;
  origin: DataOrigin;
}

export type InvestmentEventType =
  | "deposit"
  | "withdrawal"
  | "trade_buy"
  | "trade_sell"
  | "dividend"
  | "withholding_tax"
  | "fee"
  | "interest";

export interface InvestmentEvent {
  id: string;
  accountId: string;
  provider: Provider;
  type: InvestmentEventType;
  tradeDate: ISODate;
  valueDate: ISODate;
  /** Cash effect on the account in account currency (negative = cash out). */
  cashAmount: number;
  currency: CurrencyCode;
  instrumentSymbol?: string;
  quantity?: number;
  price?: number;
  /** Links a withholding tax or commission to its dividend or trade. */
  relatedEventId?: string;
  description: string;
  retrievedAt: ISODateTime;
  origin: DataOrigin;
}

// ---------------------------------------------------------------------------
// Liabilities (user-entered; open banking does not provide them)
// ---------------------------------------------------------------------------

export interface MortgageLiability {
  id: string;
  kind: "mortgage";
  origin: "user_entered";
  lender: string;
  name: string;
  /** Current outstanding debt (restgæld). */
  balance: number;
  currency: CurrencyCode;
  /** `fixed` = fastforrentet obligationslån; `adjustable` = rentetilpasning (F-kort, F3, F5...). */
  rateType: "fixed" | "adjustable";
  /** Annual coupon / interest rate as a fraction (0.05 = 5%). */
  couponRate: number;
  /** Annual contribution fee (bidragssats) on outstanding debt, as a fraction. */
  contributionRate: number;
  bondName?: string;
  /** Market price of the loan's bond (kurs), if the user or a quote feed supplied it. */
  bondPrice?: number;
  remainingTermMonths: number;
  /** Registered pledge amount (pantebrev). Refinancing up to this avoids the variable registration fee. */
  registeredPledgeAmount?: number;
  startDate: ISODate;
  enteredAt: ISODateTime;
}

export interface ConsumerLoanLiability {
  id: string;
  kind: "consumer_loan";
  origin: "user_entered";
  lender: string;
  name: string;
  balance: number;
  currency: CurrencyCode;
  /** Annual nominal rate (debitorrente) as a fraction. */
  rate: number;
  /** ÅOP as stated by the lender, informational. */
  apr?: number;
  remainingTermMonths: number;
  monthlyFee?: number;
  startDate: ISODate;
  enteredAt: ISODateTime;
}

export type Liability = MortgageLiability | ConsumerLoanLiability;

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

export type RiskTolerance = "low" | "moderate" | "high";

export type Category =
  | "income"
  | "housing"
  | "utilities"
  | "groceries"
  | "restaurants"
  | "transport"
  | "subscriptions"
  | "shopping"
  | "health"
  | "entertainment"
  | "travel"
  | "insurance"
  | "debt"
  | "fees"
  | "cash"
  | "transfer"
  | "investment"
  | "uncategorized";

export type Budgets = Partial<Record<Category, number>>;

export interface SavingsGoal {
  name: string;
  amount: number;
  date: ISODate;
  /** Account where savings for this goal are kept, if any. */
  accountId?: string;
}

export interface Goals {
  riskTolerance: RiskTolerance;
  /** Expected monthly net income (after tax). */
  monthlyIncome: number;
  /** Monthly budgets per spending category, in DKK. */
  budgets: Budgets;
  safetyNet: {
    /** Months of essential spending to hold as a safety net. */
    months: number;
    /** Optional explicit target; otherwise months x essential monthly spend. */
    targetAmount?: number;
    /** Account that holds the safety net. */
    accountId?: string;
  };
  savingsGoal?: SavingsGoal;
  /** Minimum to keep on everyday accounts; surplus above this can move to savings. */
  minimumBalance: number;
}

// ---------------------------------------------------------------------------
// Action items (shared interface with the autopilot and UI; see PRD)
// ---------------------------------------------------------------------------

export type ActionType =
  | "budget_alert"
  | "transfer_suggestion"
  | "subscription_change"
  | "anomaly"
  | "refinancing"
  | "loan_consolidation"
  | "risk_check"
  | "safety_net"
  | "connection_issue";

export type Severity = "low" | "medium" | "high";
export type ActionStatus = "new" | "approved" | "dismissed";

export interface ActionItem {
  id: string;
  runId: string;
  type: ActionType;
  title: string;
  body: string;
  amount?: number;
  accounts?: string[];
  severity: Severity;
  status: ActionStatus;
  rationale: string;
  createdAt: ISODateTime;
}

/**
 * Deterministic draft of an action item. The autopilot turns candidates into
 * ActionItems (adding id/runId/status/createdAt, rewriting title/body in plain
 * language). `key` is stable across runs so the same finding is raised once.
 */
export interface ActionCandidate {
  key: string;
  type: ActionType;
  title: string;
  body: string;
  amount?: number;
  accounts?: string[];
  severity: Severity;
  rationale: string;
  /** Simulated day on which the underlying data first made this true. */
  triggeredOn: ISODate;
  /** The computed numbers behind the candidate; the LLM must quote only these. */
  facts: Record<string, number | string | boolean | null>;
}

// ---------------------------------------------------------------------------
// Connectors
// ---------------------------------------------------------------------------

export type ConnectionState = "connected" | "consent_expired" | "bank_unavailable" | "error";

export interface ConnectionStatus {
  connectionId: string;
  provider: Provider;
  state: ConnectionState;
  /** "Demo connection" for fixtures. */
  label: string;
  origin: DataOrigin;
  consentGrantedAt?: ISODateTime;
  consentExpiresAt?: ISODateTime;
  lastSuccessfulRetrievalAt?: ISODateTime;
  message?: string;
}

export interface DateRange {
  from: ISODate;
  to: ISODate;
}

/**
 * Provider-shaped connector. Fixture connectors implement it today; an Enable
 * Banking (Danske, Revolut) or Saxo OpenAPI connector can implement it later.
 * Methods reject with `ConnectorError` for consent and availability problems.
 */
export interface Connector {
  readonly connectionId: string;
  readonly provider: Provider;
  readonly displayName: string;
  readonly origin: DataOrigin;
  getStatus(): Promise<ConnectionStatus>;
  listAccounts(): Promise<Account[]>;
  getBalances(accountId?: string): Promise<Balance[]>;
  getTransactions(range: DateRange): Promise<Transaction[]>;
  getHoldings?(): Promise<Holding[]>;
  getInvestmentEvents?(range: DateRange): Promise<InvestmentEvent[]>;
}

export type ConnectorErrorCode = "consent_expired" | "bank_unavailable" | "rate_limited" | "unknown";

export class ConnectorError extends Error {
  readonly code: ConnectorErrorCode;
  readonly provider: Provider;
  readonly lastSuccessfulRetrievalAt: ISODateTime | undefined;

  constructor(
    code: ConnectorErrorCode,
    provider: Provider,
    message: string,
    lastSuccessfulRetrievalAt?: ISODateTime,
  ) {
    super(message);
    this.name = "ConnectorError";
    this.code = code;
    this.provider = provider;
    this.lastSuccessfulRetrievalAt = lastSuccessfulRetrievalAt;
  }
}

// ---------------------------------------------------------------------------
// Dataset (what the insights consume)
// ---------------------------------------------------------------------------

export interface FxRate {
  base: CurrencyCode;
  quote: CurrencyCode;
  /** Units of quote per one unit of base, e.g. EUR->DKK 7.46. */
  rate: number;
  valuationTime: ISODateTime;
  source: string;
  origin: DataOrigin;
}

/** A quote for a Danish mortgage bond/product, used by the refinancing calculator. */
export interface MortgageBondQuote {
  date: ISODate;
  bondName: string;
  rateType: "fixed" | "adjustable";
  couponRate: number;
  /** Price per 100 nominal (kurs). */
  price: number;
  termYears: number;
  /** Typical contribution rate for the product at ~80% LTV, fraction. */
  contributionRate: number;
  source: string;
  origin: DataOrigin;
}

export interface FinanceDataset {
  asOf: ISODate;
  connections: ConnectionStatus[];
  accounts: Account[];
  balances: Balance[];
  /** Raw transactions as retrieved (may contain pending/booked duplicates). */
  transactions: Transaction[];
  holdings: Holding[];
  investmentEvents: InvestmentEvent[];
  liabilities: Liability[];
  fxRates: FxRate[];
  mortgageQuotes: MortgageBondQuote[];
}

/** A transaction after the import pipeline: deduped, transfer-matched, categorized, valued in DKK. */
export interface EnrichedTransaction extends Transaction {
  category: Category;
  categorySource: "rule" | "mcc" | "kind" | "transfer" | "none";
  /** Matched to an opposite leg on another connected account; never spend or income. */
  isInternalTransfer: boolean;
  transferPairId?: string;
  /** Amount converted to DKK using the dataset's fixture FX rate (or the transaction's own DKK amount). */
  amountDkk: number;
  /** IDs of pending records this booked record replaced. */
  replacesPendingIds?: string[];
}
