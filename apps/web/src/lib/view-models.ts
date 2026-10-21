/** Presentation contracts. Financial values come from the finance package through finance-view. */

export type Currency = "DKK" | "EUR";
export type Money = { amount: number; currency: Currency };

export type BankId = "danske" | "revolut" | "saxo";

export type Bank = {
  id: BankId;
  name: string;
  /** Short label used in transfer paths, e.g. "Danske". */
  shortName: string;
  /** Datasets the mocked consent requests. */
  permissions: { id: string; label: string; detail: string }[];
  consentDays: number;
};

export type AccountKind = "current" | "savings" | "investment";

export type Account = {
  id: string;
  bankId: BankId;
  name: string;
  kind: AccountKind;
  currency: Currency;
  /** Masked identifier, optional because banks do not always return it. */
  maskedNumber?: string;
  balance: Money;
  /** Balance converted to DKK. For investment accounts this is the total account value. */
  balanceDkk: number;
  /** Investment accounts only: cash part and positions part of `balanceDkk`. */
  cashDkk?: number;
  positionsDkk?: number;
  balanceType: "booked" | "available";
  retrievedAt: string;
};

export type CategoryId =
  | "groceries"
  | "restaurants"
  | "transport"
  | "shopping"
  | "subscriptions"
  | "entertainment";

export type Transaction = {
  id: string;
  accountId: string;
  date: string;
  amount: Money;
  /** Original amount when the purchase was in another currency. */
  originalAmount?: Money;
  merchant?: string;
  description: string;
  category?: CategoryId;
  status: "booked" | "pending";
  /** Transfers between the user's own accounts do not count as spending. */
  internalTransfer?: boolean;
};

export type RiskTolerance = "conservative" | "balanced" | "growth";

export type Goals = {
  monthlyIncome: number;
  riskTolerance: RiskTolerance;
  safetyNetMonths: number;
  savingsGoal: { name: string; target: number; date: string };
  budgets: Record<CategoryId, number>;
};

/** Agent-proposed goals, with a one-line reason per field shown as "Penny suggests…". */
export type GoalSuggestion = {
  goals: Goals;
  reasons: {
    monthlyIncome: string;
    riskTolerance: string;
    safetyNetMonths: string;
    savingsGoal: string;
    budgets: Partial<Record<CategoryId, string>>;
  };
};

export type Severity = "info" | "warning" | "critical";
export type ActionStatus = "new" | "approved" | "dismissed";
export type ActionItemType =
  "budget_alert" | "transfer" | "insight" | "refinancing" | "risk";

export type ActionItem = {
  id: string;
  runId: string;
  type: ActionItemType;
  title: string;
  body: string;
  amount?: Money;
  /** Account ids involved. For transfers: [from, to]. */
  accounts?: string[];
  severity: Severity;
  status: ActionStatus;
  rationale: string;
  createdAt: string;
  feedback?: "not_useful";
  candidateKey?: string;
  goalRevision?: number;
  facts?: Record<string, number | string | boolean | null>;
  triggeredOn?: string;
};

export type AutopilotRun = {
  id: string;
  /** Simulated date the run reviewed. */
  date: string;
  ranAt: string;
  summary: string;
  checks: string[];
  newItemCount: number;
  goalRevision?: number;
  engine?: "claude";
};

export type CategorySpend = {
  category: CategoryId;
  label: string;
  spent: number;
  budget?: number;
};

export type UpcomingBill = {
  id: string;
  name: string;
  date: string;
  amount: number;
  /** True when the date or amount is predicted from history rather than a retrieved schedule. */
  estimated: boolean;
};

export type BankSummary = { bank: Bank; accounts: Account[]; totalDkk: number };

export type HomeVM = {
  date: string;
  firstName: string;
  total: { totalDkk: number; cashDkk: number; investmentsDkk: number };
  banks: BankSummary[];
  spending: {
    monthLabel: string;
    daysLeftInMonth: number;
    spent: number;
    budget: number;
    categories: CategorySpend[];
  };
  forecast: {
    available?: boolean;
    payday: string;
    daysToPayday: number;
    balanceToday: number;
    projectedAtPayday: number;
    bills: UpcomingBill[];
  };
  safetyNet: {
    months: number;
    targetMonths: number;
    bufferDkk: number;
    monthlyEssentials: number;
  };
  savingsGoal: { name: string; target: number; saved: number; date: string };
  latestRun?: AutopilotRun;
  newActionCount: number;
  recent: Transaction[];
  warnings?: string[];
};

const DEFAULT_PERMISSIONS: Bank["permissions"] = [
  {
    id: "accounts",
    label: "Accounts",
    detail: "Names, numbers and currencies",
  },
  {
    id: "balances",
    label: "Balances",
    detail: "Booked and available balances",
  },
  {
    id: "transactions",
    label: "Transactions",
    detail: "Up to 90 days of history",
  },
];

export const BANKS: Bank[] = [
  {
    id: "danske",
    name: "Danske Bank",
    shortName: "Danske",
    permissions: DEFAULT_PERMISSIONS,
    consentDays: 90,
  },
  {
    id: "revolut",
    name: "Revolut",
    shortName: "Revolut",
    permissions: DEFAULT_PERMISSIONS,
    consentDays: 90,
  },
  {
    id: "saxo",
    name: "Saxo Bank",
    shortName: "Saxo",
    permissions: [
      ...DEFAULT_PERMISSIONS,
      {
        id: "holdings",
        label: "Holdings",
        detail: "Positions, values and performance",
      },
    ],
    consentDays: 90,
  },
];

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  groceries: "Groceries",
  restaurants: "Restaurants & cafés",
  transport: "Transport",
  shopping: "Shopping",
  subscriptions: "Subscriptions",
  entertainment: "Entertainment",
};

export const CATEGORY_ORDER: CategoryId[] = [
  "groceries",
  "restaurants",
  "shopping",
  "transport",
  "entertainment",
  "subscriptions",
];

export function parseDate(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`);
}

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = parseDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toIsoDate(d);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round(
    (parseDate(toIso).getTime() - parseDate(fromIso).getTime()) / 86_400_000,
  );
}

/** Simulated transfer adjustments in the account currency. */
export type BalanceAdjustments = Record<string, number>;
export function getBank(id: BankId): Bank {
  return BANKS.find((bank) => bank.id === id) ?? BANKS[0]!;
}
