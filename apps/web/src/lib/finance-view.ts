import {
  ACCOUNT_IDS,
  DEFAULT_GOALS,
  getSnapshot,
  loadDemoDataset,
  proposeGoals,
  type FinanceDataset,
  type Goals as FinanceGoals,
  type Provider,
} from "@claude-impact-lab/finance";
import type { DemoState } from "./demo-types";
import {
  BANKS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type Account,
  type BankId,
  type Currency,
  type GoalSuggestion,
  type Goals,
  type HomeVM,
} from "./view-models";

const providerByBank: Record<BankId, Provider> = {
  danske: "danske_bank",
  revolut: "revolut",
  saxo: "saxo",
};
const bankByProvider: Record<Provider, BankId> = {
  danske_bank: "danske",
  revolut: "revolut",
  saxo: "saxo",
};

export function toUiGoals(goals: FinanceGoals): Goals {
  return {
    monthlyIncome: goals.monthlyIncome,
    riskTolerance: {
      low: "conservative",
      moderate: "balanced",
      high: "growth",
    }[goals.riskTolerance] as Goals["riskTolerance"],
    safetyNetMonths: goals.safetyNet.months,
    savingsGoal: {
      name: goals.savingsGoal?.name ?? "Savings",
      target: goals.savingsGoal?.amount ?? 0,
      date: goals.savingsGoal?.date ?? "2027-06-01",
    },
    budgets: Object.fromEntries(
      CATEGORY_ORDER.map((category) => [
        category,
        goals.budgets[category] ?? 0,
      ]),
    ) as Goals["budgets"],
  };
}

export function toDomainGoals(goals: Goals): FinanceGoals {
  return {
    ...DEFAULT_GOALS,
    monthlyIncome: goals.monthlyIncome,
    riskTolerance: {
      conservative: "low",
      balanced: "moderate",
      growth: "high",
    }[goals.riskTolerance] as FinanceGoals["riskTolerance"],
    safetyNet: { ...DEFAULT_GOALS.safetyNet, months: goals.safetyNetMonths },
    budgets: { ...DEFAULT_GOALS.budgets, ...goals.budgets },
    savingsGoal: {
      ...DEFAULT_GOALS.savingsGoal,
      name: goals.savingsGoal.name,
      amount: goals.savingsGoal.target,
      date: goals.savingsGoal.date,
    },
  };
}

export async function buildFinanceView(state: DemoState) {
  const all = await loadDemoDataset(state.simulatedDate);
  const providers = new Set(
    state.connectedBanks.map((bank) => providerByBank[bank]),
  );
  const accountIds = new Set(
    all.accounts
      .filter((account) => providers.has(account.provider))
      .map((account) => account.id),
  );
  const dataset: FinanceDataset = {
    ...all,
    connections: all.connections.filter((connection) =>
      providers.has(connection.provider),
    ),
    accounts: all.accounts.filter((account) => accountIds.has(account.id)),
    balances: all.balances
      .filter((balance) => accountIds.has(balance.accountId))
      .map((balance) => ({
        ...balance,
        amount:
          balance.amount +
          ([
            "booked",
            "available",
            "investment_cash",
            "investment_total",
          ].includes(balance.type)
            ? (state.adjustments[balance.accountId] ?? 0)
            : 0),
      })),
    transactions: all.transactions.filter((transaction) =>
      accountIds.has(transaction.accountId),
    ),
    holdings: all.holdings.filter((holding) =>
      accountIds.has(holding.accountId),
    ),
    investmentEvents: all.investmentEvents.filter((event) =>
      accountIds.has(event.accountId),
    ),
    liabilities: providers.has("danske_bank") ? all.liabilities : [],
    mortgageQuotes: providers.has("danske_bank") ? all.mortgageQuotes : [],
  };
  const domainGoals = toDomainGoals(state.goals);
  const snapshot = getSnapshot(dataset, domainGoals);
  const fx = (amount: number, currency: string) =>
    currency === "DKK"
      ? amount
      : amount *
        (dataset.fxRates.find(
          (rate) => rate.base === currency && rate.quote === "DKK",
        )?.rate ?? 0);
  const accounts: Account[] = dataset.accounts.map((account) => {
    const balances = dataset.balances.filter(
      (balance) => balance.accountId === account.id,
    );
    const selected =
      balances.find((balance) => balance.type === "investment_total") ??
      balances.find((balance) => balance.type === "booked") ??
      balances.find((balance) => balance.type === "available");
    const amount = selected?.amount ?? 0;
    return {
      id: account.id,
      bankId: bankByProvider[account.provider],
      name: account.nickname ?? account.name,
      kind:
        account.type === "investment"
          ? "investment"
          : account.type === "savings"
            ? "savings"
            : "current",
      currency: account.currency as Currency,
      maskedNumber: account.maskedIdentifier,
      balance: { amount, currency: account.currency as Currency },
      balanceDkk: fx(amount, account.currency),
      balanceType: selected?.type === "available" ? "available" : "booked",
      retrievedAt: selected?.retrievedAt ?? account.retrievedAt,
      ...(account.type === "investment"
        ? {
            cashDkk: fx(
              balances.find((balance) => balance.type === "investment_cash")
                ?.amount ?? 0,
              account.currency,
            ),
            positionsDkk: fx(
              balances.find(
                (balance) => balance.type === "investment_positions",
              )?.amount ?? 0,
              account.currency,
            ),
          }
        : {}),
    };
  });
  const proposed = proposeGoals(dataset);
  const suggestion: GoalSuggestion = {
    goals: { ...toUiGoals(proposed), savingsGoal: state.goals.savingsGoal },
    reasons: {
      monthlyIncome: "Net salary estimated from the connected account history.",
      riskTolerance:
        "A starting preference to review. Your holdings do not establish your risk tolerance.",
      safetyNetMonths:
        "A starting target based on essential spending. Adjust it to your circumstances.",
      savingsGoal:
        "An example goal you can rename. The safety net takes priority over this goal.",
      budgets: Object.fromEntries(
        CATEGORY_ORDER.map((category) => [
          category,
          "Calculated from completed months of connected transaction history.",
        ]),
      ),
    },
  };
  const categories = CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    spent:
      snapshot.budgets.find((budget) => budget.category === category)?.spent ??
      0,
    budget: state.goals.budgets[category],
  }));
  const date = new Date(`${state.simulatedDate}T00:00:00Z`);
  const buffer =
    accounts.find((account) => account.id === ACCOUNT_IDS.danskeSavings)
      ?.balanceDkk ?? 0;
  const home: HomeVM = {
    date: state.simulatedDate,
    firstName: "Sofie",
    total: snapshot.totals,
    banks: BANKS.filter((bank) => state.connectedBanks.includes(bank.id)).map(
      (bank) => ({
        bank,
        accounts: accounts.filter((account) => account.bankId === bank.id),
        totalDkk: accounts
          .filter((account) => account.bankId === bank.id)
          .reduce((sum, account) => sum + account.balanceDkk, 0),
      }),
    ),
    spending: {
      monthLabel: date.toLocaleDateString("en-GB", {
        month: "long",
        timeZone: "UTC",
      }),
      daysLeftInMonth:
        new Date(
          Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
        ).getUTCDate() - date.getUTCDate(),
      spent: categories.reduce((sum, category) => sum + category.spent, 0),
      budget: categories.reduce(
        (sum, category) => sum + (category.budget ?? 0),
        0,
      ),
      categories,
    },
    forecast: {
      available:
        snapshot.forecast.reliable && snapshot.forecast.nextPayday !== null,
      payday: snapshot.forecast.nextPayday ?? state.simulatedDate,
      daysToPayday: snapshot.forecast.daysToPayday ?? 0,
      balanceToday: snapshot.forecast.todayBalanceDkk,
      projectedAtPayday: snapshot.forecast.projectedAtPaydayDkk ?? 0,
      bills: snapshot.forecast.bills.map((bill) => ({
        id: bill.id,
        name: bill.name,
        date: bill.date,
        amount: bill.amountDkk,
        estimated: bill.estimated,
      })),
    },
    safetyNet: {
      months: snapshot.safetyNet.months,
      targetMonths: state.goals.safetyNetMonths,
      bufferDkk: snapshot.safetyNet.bufferDkk,
      monthlyEssentials: snapshot.safetyNet.monthlyEssentialsDkk,
    },
    savingsGoal: {
      ...state.goals.savingsGoal,
      saved: Math.max(0, buffer - snapshot.safetyNet.targetDkk),
    },
    latestRun: state.runs[0],
    newActionCount: state.actions.filter((action) => action.status === "new")
      .length,
    recent: snapshot.transactions
      .slice()
      .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate))
      .slice(0, 8)
      .map((transaction) => ({
        id: transaction.id,
        accountId: transaction.accountId,
        date: transaction.bookingDate ?? transaction.transactionDate,
        amount: {
          amount: transaction.amount,
          currency: transaction.currency as Currency,
        },
        originalAmount: transaction.originalAmount as
          Account["balance"] | undefined,
        merchant: transaction.merchantName,
        description:
          transaction.description ??
          transaction.counterpartyName ??
          "Bank transaction",
        category: CATEGORY_ORDER.includes(
          transaction.category as (typeof CATEGORY_ORDER)[number],
        )
          ? (transaction.category as (typeof CATEGORY_ORDER)[number])
          : undefined,
        status: transaction.status,
        internalTransfer: transaction.isInternalTransfer,
      })),
    warnings: snapshot.warnings,
  };
  return {
    home,
    accounts,
    suggestion,
    candidates: snapshot.candidates,
    dataset,
    domainGoals,
    snapshot,
  };
}
