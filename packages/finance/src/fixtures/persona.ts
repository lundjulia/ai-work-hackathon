/**
 * Synthetic demo persona. Every value here is invented fixture data shaped like
 * the documented bank APIs (see docs/open-banking-data-support.md). None of it
 * was retrieved from a bank.
 */
import type {
  Account,
  ConsumerLoanLiability,
  FxRate,
  Goals,
  ISODate,
  MortgageBondQuote,
  MortgageLiability,
} from "../types.ts";

export const SYNTHETIC_LABEL = "Demo connection (synthetic data)";

/** Fixed demo "today": the day the persona onboards (a Monday). */
export const DEMO_DATE: ISODate = "2026-10-19";
/** First day of the 90-day imported history (inclusive). */
export const HISTORY_START: ISODate = "2026-07-22";
/** Last day of generated activity. Advancing `asOf` up to here reveals new transactions. */
export const FIXTURE_END: ISODate = "2026-11-02";
/** Seed for all randomised fixture generation. */
export const FIXTURE_SEED = 20261019;

export const PERSONA = {
  id: "persona-sofie-jensen",
  name: "Sofie Jensen",
  age: 34,
  city: "Copenhagen (Valby)",
  occupation: "Senior UX designer at Nordvej Studio ApS (fictional employer)",
  housing: "Owner-occupied flat (ejerlejlighed) bought in 2024 with a Totalkredit-style realkreditlån",
  netMonthlySalary: 34_600,
  employer: "NORDVEJ STUDIO APS",
  synthetic: true,
} as const;

export const CONNECTIONS = {
  danske: "conn-danske-demo",
  revolut: "conn-revolut-demo",
  saxo: "conn-saxo-demo",
} as const;

/** Account IDs are `<provider>:<sourceAccountId>`. */
export const ACCOUNT_IDS = {
  danskeEveryday: "danske_bank:8f3c2a71-5d0e-4b8a-9c1d-2e6f0a4b7c11",
  danskeSavings: "danske_bank:1b9e4d02-77a3-4c5f-8e21-9d0c3f6a5b28",
  revolutDkk: "revolut:6a1f0c9e-3b7d-4e25-a8f0-5c2d9e1b7a40",
  revolutEur: "revolut:6a1f0c9e-3b7d-4e25-a8f0-5c2d9e1b7a41",
  saxo: "saxo:9kQ2xN7vT3aLm8YpR1cB-g==",
} as const;

type AccountSeed = Omit<Account, "retrievedAt">;

export const FIXTURE_ACCOUNTS: readonly AccountSeed[] = [
  {
    id: ACCOUNT_IDS.danskeEveryday,
    provider: "danske_bank",
    connectionId: CONNECTIONS.danske,
    sourceAccountId: "8f3c2a71-5d0e-4b8a-9c1d-2e6f0a4b7c11",
    type: "current",
    currency: "DKK",
    name: "Danske Konto",
    // nickname intentionally absent: optional in Danske's PSD2 schema
    maskedIdentifier: "DK** **** **** 4417",
    ownerName: "Sofie Jensen",
    isEveryday: true,
    origin: "synthetic_fixture",
  },
  {
    id: ACCOUNT_IDS.danskeSavings,
    provider: "danske_bank",
    connectionId: CONNECTIONS.danske,
    sourceAccountId: "1b9e4d02-77a3-4c5f-8e21-9d0c3f6a5b28",
    type: "savings",
    currency: "DKK",
    name: "Danske Opsparing",
    nickname: "Buffer",
    maskedIdentifier: "DK** **** **** 9052",
    ownerName: "Sofie Jensen",
    isEveryday: false,
    origin: "synthetic_fixture",
  },
  {
    id: ACCOUNT_IDS.revolutDkk,
    provider: "revolut",
    connectionId: CONNECTIONS.revolut,
    sourceAccountId: "6a1f0c9e-3b7d-4e25-a8f0-5c2d9e1b7a40",
    type: "current",
    currency: "DKK",
    name: "Revolut DKK",
    // Same IBAN as the EUR account: never key accounts by IBAN alone.
    maskedIdentifier: "LT** **** **** **** 2291",
    ownerName: "SOFIE JENSEN",
    isEveryday: true,
    origin: "synthetic_fixture",
  },
  {
    id: ACCOUNT_IDS.revolutEur,
    provider: "revolut",
    connectionId: CONNECTIONS.revolut,
    sourceAccountId: "6a1f0c9e-3b7d-4e25-a8f0-5c2d9e1b7a41",
    type: "current",
    currency: "EUR",
    name: "Revolut EUR",
    maskedIdentifier: "LT** **** **** **** 2291",
    ownerName: "SOFIE JENSEN",
    isEveryday: false,
    origin: "synthetic_fixture",
  },
  {
    id: ACCOUNT_IDS.saxo,
    provider: "saxo",
    connectionId: CONNECTIONS.saxo,
    sourceAccountId: "9kQ2xN7vT3aLm8YpR1cB-g==",
    type: "investment",
    currency: "DKK",
    name: "Saxo Investment Account",
    nickname: "Frie midler",
    maskedIdentifier: "Saxo 1784****",
    ownerName: "Sofie Jensen",
    isEveryday: false,
    origin: "synthetic_fixture",
  },
];

/**
 * Closing booked balances at DEMO_DATE. Danske everyday, both Revolut accounts
 * and Saxo match docs/demo-data-availability.md; Danske Opsparing is an added
 * savings account so a surplus transfer has a destination.
 */
export const DEMO_DATE_BALANCES = {
  [ACCOUNT_IDS.danskeEveryday]: 18_500,
  [ACCOUNT_IDS.danskeSavings]: 25_000,
  [ACCOUNT_IDS.revolutDkk]: 3_200,
  [ACCOUNT_IDS.revolutEur]: 140,
  /** Saxo cash only; positions are valued separately (DKK 95,000). */
  [ACCOUNT_IDS.saxo]: 5_000,
} as const;

export const SAXO_POSITIONS_TARGET = 95_000;

/** Last close used for all Saxo valuations (Friday before the demo Monday). */
export const SAXO_VALUATION_TIME = "2026-10-16T15:30:00.000Z";

export const FX_RATES: readonly FxRate[] = [
  {
    base: "EUR",
    quote: "DKK",
    rate: 7.4612,
    valuationTime: "2026-10-16T14:00:00.000Z",
    source: "Synthetic fixture rate near the DKK/EUR peg (not a retrieved ECB fixing)",
    origin: "synthetic_fixture",
  },
  {
    base: "SEK",
    quote: "DKK",
    rate: 0.6561,
    valuationTime: "2026-10-16T14:00:00.000Z",
    source: "Synthetic fixture rate",
    origin: "synthetic_fixture",
  },
];

export const MORTGAGE: MortgageLiability = {
  id: "liability-mortgage",
  kind: "mortgage",
  origin: "user_entered",
  lender: "Totalkredit (sample, user-entered)",
  name: "Realkreditlån, fastforrentet 5% 2056",
  balance: 2_400_000,
  currency: "DKK",
  rateType: "fixed",
  couponRate: 0.05,
  contributionRate: 0.0075,
  bondName: "5% Totalkredit 2056",
  bondPrice: 100.6,
  remainingTermMonths: 330,
  registeredPledgeAmount: 2_495_000,
  startDate: "2024-04-01",
  enteredAt: "2026-10-19T08:15:00.000Z",
};

export const CONSUMER_LOAN: ConsumerLoanLiability = {
  id: "liability-consumer-loan",
  kind: "consumer_loan",
  origin: "user_entered",
  lender: "Kvik Finans (fictional lender)",
  name: "Forbrugslån (kitchen renovation)",
  balance: 60_000,
  currency: "DKK",
  rate: 0.139,
  apr: 0.162,
  remainingTermMonths: 48,
  monthlyFee: 0,
  startDate: "2025-03-25",
  enteredAt: "2026-10-19T08:16:00.000Z",
};

/**
 * Synthetic mortgage bond quotes. The 4% bond's price rises on 2026-10-26,
 * which makes refinancing (nedkonvertering) pass the break-even threshold.
 */
export const MORTGAGE_QUOTES: readonly MortgageBondQuote[] = [
  {
    date: "2026-10-01",
    bondName: "5% Totalkredit 2056",
    rateType: "fixed",
    couponRate: 0.05,
    price: 100.6,
    termYears: 30,
    contributionRate: 0.0075,
    source: "Synthetic fixture quote",
    origin: "synthetic_fixture",
  },
  {
    date: "2026-10-01",
    bondName: "4% Totalkredit 2056",
    rateType: "fixed",
    couponRate: 0.04,
    price: 96.6,
    termYears: 30,
    contributionRate: 0.0075,
    source: "Synthetic fixture quote",
    origin: "synthetic_fixture",
  },
  {
    date: "2026-10-26",
    bondName: "4% Totalkredit 2056",
    rateType: "fixed",
    couponRate: 0.04,
    price: 98.4,
    termYears: 30,
    contributionRate: 0.0075,
    source: "Synthetic fixture quote",
    origin: "synthetic_fixture",
  },
  {
    date: "2026-10-01",
    bondName: "F-kort (CITA-based adjustable)",
    rateType: "adjustable",
    couponRate: 0.0245,
    price: 100,
    termYears: 30,
    contributionRate: 0.0095,
    source: "Synthetic fixture quote",
    origin: "synthetic_fixture",
  },
];

/**
 * An example of edited, accepted goals for the demo persona.
 * `proposeGoals()` derives its own defaults from completed-month history.
 */
export const DEMO_GOALS: Goals = {
  riskTolerance: "moderate",
  monthlyIncome: PERSONA.netMonthlySalary,
  budgets: {
    groceries: 3_400,
    restaurants: 2_500,
    transport: 700,
    shopping: 1_100,
    health: 300,
    entertainment: 300,
  },
  safetyNet: { months: 3, accountId: ACCOUNT_IDS.danskeSavings },
  savingsGoal: { name: "Japan trip", amount: 30_000, date: "2027-06-01", accountId: ACCOUNT_IDS.danskeSavings },
  minimumBalance: 10_000,
};

/** What advancing the simulated clock reveals. Asserted in tests. */
export const DEMO_TIMELINE: readonly { date: ISODate; event: string; expectedActionTypes: string[] }[] = [
  {
    date: "2026-10-19",
    event: "Onboarding day (DEMO_DATE). Restaurants at ~48% of budget. Matas DKK 249 is pending on Revolut.",
    expectedActionTypes: ["risk_check", "safety_net", "loan_consolidation"],
  },
  {
    date: "2026-10-20",
    event: "Matas DKK 249 books with a new ID while the pending record is still returned; dedupe keeps one.",
    expectedActionTypes: [],
  },
  {
    date: "2026-10-21",
    event: "Dinner at Bæst pushes restaurants to ~86% of budget with 10 days left.",
    expectedActionTypes: ["budget_alert"],
  },
  {
    date: "2026-10-22",
    event: "Elgiganten charges DKK 1,299 twice on the same day (possible duplicate).",
    expectedActionTypes: ["anomaly"],
  },
  {
    date: "2026-10-23",
    event: "Netflix charges DKK 149 instead of DKK 129 (price increase).",
    expectedActionTypes: ["subscription_change"],
  },
  {
    date: "2026-10-26",
    event: "4% Totalkredit 2056 rises to 98.4; refinancing breaks even within the threshold.",
    expectedActionTypes: ["refinancing"],
  },
  {
    date: "2026-10-29",
    event: "Wolt order takes restaurants over budget.",
    expectedActionTypes: ["budget_alert"],
  },
  {
    date: "2026-10-30",
    event: "Salary lands. The October cycle left a surplus above the minimum balance; propose moving it to savings.",
    expectedActionTypes: ["transfer_suggestion"],
  },
];
