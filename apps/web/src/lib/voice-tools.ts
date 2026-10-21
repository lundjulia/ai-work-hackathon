// Voice tools: the single adapter between the gpt-realtime voice agent and the app's finance data.
// Server-only. Used by /api/realtime/session (tool definitions + instructions) and
// /api/realtime/tool (execution). The model phrases answers; every number comes from this module.
//
// DATA SOURCE: `@claude-impact-lab/finance` is not wired into apps/web yet, so `placeholderSource`
// below supplies clearly marked PLACEHOLDER data shaped after docs/demo-data-availability.md.
// To switch: implement `VoiceDataSource` on top of the finance package and change `dataSource`.
// The tool functions and their JSON contracts stay the same.

import { z } from "zod";

// ---------------------------------------------------------------------------------------------
// Data-source contract (what the tools need from the finance core)
// ---------------------------------------------------------------------------------------------

type Account = {
  id: string;
  bank: "Danske Bank" | "Revolut" | "Saxo Bank";
  name: string;
  kind: "cash" | "investment";
  currency: "DKK" | "EUR";
  balance: number; // in account currency
  /** For investment accounts: cash part of `balance` (already included in it). */
  cashPart?: number;
};

type Budget = { category: string; limitDkk: number; spentDkk: number };

type Recurring = {
  name: string;
  amountDkk: number; // negative = outflow, positive = inflow
  dayOfMonth: number | "last_banking_day";
  accountId: string;
};

type ActionItem = {
  id: string;
  runId: string;
  type: "budget_alert" | "money_routing" | "refinancing" | "insight" | "risk_check";
  title: string;
  body: string;
  amount?: number;
  accounts?: string[];
  severity: "info" | "warning" | "critical";
  status: "new" | "approved" | "dismissed";
  rationale: string;
  createdAt: string;
  /** Inputs behind the item, so the agent can explain it without inventing numbers. */
  facts?: Record<string, number | string>;
};

type Goals = {
  riskTolerance: "low" | "medium" | "high";
  monthlyNetIncomeDkk: number;
  safetyNet: { floorDkk: number; targetMonths: number; monthlyEssentialsDkk: number };
  savingsGoal: {
    name: string;
    targetDkk: number;
    savedDkk: number;
    monthlyContributionDkk: number;
    targetDate: string;
  };
};

type VoiceDataSource = {
  label: "placeholder" | "finance";
  userName: string;
  today: () => string; // ISO date (simulated clock)
  fxToDkk: { EUR: number; valuationNote: string };
  accounts: () => Account[];
  budgets: () => Budget[];
  /** Budget categories that are spent only when planned (excluded from the baseline forecast). */
  plannedOnlyCategories: string[];
  recurring: () => Recurring[];
  actionItems: () => ActionItem[];
  goals: () => Goals;
};

// ---------------------------------------------------------------------------------------------
// PLACEHOLDER DATA: replace with @claude-impact-lab/finance when it is importable from apps/web.
// Amounts are invented demo targets, not app calculations over fixtures.
// ---------------------------------------------------------------------------------------------

const PLACEHOLDER_TODAY = "2026-10-21";

const placeholderSource: VoiceDataSource = {
  label: "placeholder",
  userName: "Sofie",
  today: () => PLACEHOLDER_TODAY,
  fxToDkk: { EUR: 7.46, valuationNote: "Fixed demo rate EUR/DKK 7.46" },
  accounts: () => [
    { id: "danske-everyday", bank: "Danske Bank", name: "Lønkonto", kind: "cash", currency: "DKK", balance: 18_500 },
    { id: "revolut-dkk", bank: "Revolut", name: "DKK account", kind: "cash", currency: "DKK", balance: 3_200 },
    { id: "revolut-eur", bank: "Revolut", name: "EUR account", kind: "cash", currency: "EUR", balance: 140 },
    {
      id: "saxo-invest",
      bank: "Saxo Bank",
      name: "Investment account",
      kind: "investment",
      currency: "DKK",
      balance: 100_000,
      cashPart: 5_000,
    },
  ],
  budgets: () => [
    { category: "groceries", limitDkk: 4_000, spentDkk: 2_900 },
    { category: "restaurants", limitDkk: 2_000, spentDkk: 1_700 },
    { category: "transport", limitDkk: 800, spentDkk: 520 },
    { category: "shopping", limitDkk: 1_500, spentDkk: 900 },
    { category: "entertainment", limitDkk: 600, spentDkk: 350 },
    { category: "travel", limitDkk: 3_000, spentDkk: 0 },
  ],
  plannedOnlyCategories: ["travel"],
  recurring: () => [
    { name: "Salary", amountDkk: 26_000, dayOfMonth: "last_banking_day", accountId: "danske-everyday" },
    { name: "Mortgage payment (realkredit)", amountDkk: -7_200, dayOfMonth: 1, accountId: "danske-everyday" },
    { name: "Owners' association (ejerforening)", amountDkk: -2_100, dayOfMonth: 1, accountId: "danske-everyday" },
    { name: "Insurance", amountDkk: -450, dayOfMonth: 1, accountId: "danske-everyday" },
    { name: "Monthly transfer to Saxo", amountDkk: -3_000, dayOfMonth: 1, accountId: "danske-everyday" },
    { name: "Fitness membership", amountDkk: -299, dayOfMonth: 3, accountId: "danske-everyday" },
    { name: "Electricity", amountDkk: -650, dayOfMonth: 5, accountId: "danske-everyday" },
    { name: "Phone", amountDkk: -149, dayOfMonth: 10, accountId: "danske-everyday" },
    { name: "Netflix", amountDkk: -129, dayOfMonth: 15, accountId: "revolut-dkk" },
  ],
  actionItems: (): ActionItem[] => [
    {
      id: "ai_restaurant_budget",
      runId: "run_2026-10-21",
      type: "budget_alert",
      title: "Restaurant budget at 85%",
      body: "You've spent 1,700 kr. of your 2,000 kr. restaurant budget with 10 days left in October.",
      severity: "warning",
      status: "new",
      rationale: "Spending pace would end the month about 510 kr. over budget.",
      createdAt: "2026-10-21T07:00:00+02:00",
      facts: { category: "restaurants" },
    },
    {
      id: "ai_surplus_savings",
      runId: "run_2026-10-21",
      type: "money_routing",
      title: "Move 3,000 kr. surplus to savings",
      body: "Your everyday account will stay above your 10,000 kr. safety net after this month's bills, leaving about 3,000 kr. spare.",
      amount: 3_000,
      accounts: ["danske-everyday", "saxo-invest"],
      severity: "info",
      status: "new",
      rationale: "Forecast low point before next salary stays above the safety-net floor with the transfer.",
      createdAt: "2026-10-21T07:00:00+02:00",
      facts: { savingsGoal: "Down payment", transferDkk: 3_000 },
    },
    {
      id: "ai_refinance",
      runId: "run_2026-10-21",
      type: "refinancing",
      title: "Mortgage refinancing could save money",
      body: "Refinancing (omlægning) from a 5% to a 4% fixed-rate loan could lower your interest cost by about 8,000 kr. a year after tax.",
      severity: "info",
      status: "new",
      rationale: "Placeholder estimate: 1,200,000 kr. principal, 1 percentage point lower rate, 33% interest deduction (rentefradrag), 15,000 kr. one-off fees.",
      createdAt: "2026-10-21T07:00:00+02:00",
      facts: {
        principalDkk: 1_200_000,
        currentRatePct: 5,
        newRatePct: 4,
        interestSavingBeforeTaxDkk: 12_000,
        deductionRatePct: 33,
        interestSavingAfterTaxDkk: 8_040,
        oneOffFeesDkk: 15_000,
        breakEvenMonths: 23,
        note: "Placeholder estimate; finance core computes the real figures",
      },
    },
  ],
  goals: () => ({
    riskTolerance: "medium",
    monthlyNetIncomeDkk: 26_000,
    safetyNet: { floorDkk: 10_000, targetMonths: 3, monthlyEssentialsDkk: 14_000 },
    savingsGoal: {
      name: "Down payment",
      targetDkk: 200_000,
      savedDkk: 100_000,
      monthlyContributionDkk: 3_000,
      targetDate: "2029-06-30",
    },
  }),
};

const dataSource: VoiceDataSource = placeholderSource;

// ---------------------------------------------------------------------------------------------
// Date + forecast helpers (deterministic)
// ---------------------------------------------------------------------------------------------

const DAY_MS = 86_400_000;
const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toIso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => toIso(new Date(toDate(iso).getTime() + n * DAY_MS));
const daysInMonth = (iso: string) => {
  const d = toDate(iso);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
};
const dayOfMonth = (iso: string) => toDate(iso).getUTCDate();
const sameMonth = (a: string, b: string) => a.slice(0, 7) === b.slice(0, 7);

/** Last weekday of the month (Danish bank holidays ignored). */
function lastBankingDay(iso: string) {
  const d = toDate(iso);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  while (last.getUTCDay() === 0 || last.getUTCDay() === 6) last.setUTCDate(last.getUTCDate() - 1);
  return toIso(last);
}

const round = (n: number) => Math.round(n);

function toDkk(a: Account) {
  return a.currency === "EUR" ? a.balance * dataSource.fxToDkk.EUR : a.balance;
}

/** Everyday DKK cash that bills and card spending come from (forecast base). */
function spendableCashDkk() {
  return dataSource
    .accounts()
    .filter((a) => a.kind === "cash" && a.currency === "DKK")
    .reduce((s, a) => s + a.balance, 0);
}

function baselineDailySpend(iso: string) {
  const monthly = dataSource
    .budgets()
    .filter((b) => !dataSource.plannedOnlyCategories.includes(b.category))
    .reduce((s, b) => s + b.limitDkk, 0);
  return monthly / daysInMonth(iso);
}

type ForecastDay = { date: string; balance: number; events: string[] };

/** Day-by-day spendable cash from tomorrow to `until` (inclusive), at budget pace plus recurring items. */
function forecast(until: string): ForecastDay[] {
  const today = dataSource.today();
  const recurring = dataSource.recurring();
  let balance = spendableCashDkk();
  const days: ForecastDay[] = [];
  for (let d = addDays(today, 1); d <= until; d = addDays(d, 1)) {
    const events: string[] = [];
    balance -= baselineDailySpend(d);
    for (const r of recurring) {
      const due = r.dayOfMonth === "last_banking_day" ? d === lastBankingDay(d) : dayOfMonth(d) === r.dayOfMonth;
      if (due) {
        balance += r.amountDkk;
        events.push(r.name);
      }
    }
    days.push({ date: d, balance, events });
  }
  return days;
}

function nextSalaryAfter(iso: string) {
  let candidate = lastBankingDay(iso);
  if (candidate <= iso) candidate = lastBankingDay(addDays(`${iso.slice(0, 7)}-01`, 32));
  return candidate;
}

// ---------------------------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------------------------

function getOverview() {
  const accounts = dataSource.accounts();
  const cash = accounts.filter((a) => a.kind === "cash").reduce((s, a) => s + toDkk(a), 0);
  const investments = accounts.filter((a) => a.kind === "investment").reduce((s, a) => s + toDkk(a), 0);
  const today = dataSource.today();
  const salary = nextSalaryAfter(today);
  const days = forecast(addDays(salary, -1));
  const low = days.reduce((m, d) => (d.balance < m.balance ? d : m), days[0] ?? { date: today, balance: spendableCashDkk(), events: [] });
  const budgets = dataSource.budgets();
  const upcoming = forecast(addDays(today, 14)).flatMap((d) =>
    d.events.map((name) => ({ date: d.date, name, amountDkk: dataSource.recurring().find((r) => r.name === name)?.amountDkk ?? 0 })),
  );
  return {
    today,
    totalDkk: round(cash + investments),
    cashDkk: round(cash),
    investmentsDkk: round(investments),
    accounts: accounts.map((a) => ({
      bank: a.bank,
      name: a.name,
      currency: a.currency,
      balance: a.balance,
      balanceDkk: round(toDkk(a)),
      ...(a.cashPart !== undefined ? { includesCashDkk: a.cashPart } : {}),
    })),
    spendingThisMonthDkk: round(budgets.reduce((s, b) => s + b.spentDkk, 0)),
    spendingByCategoryDkk: Object.fromEntries(budgets.map((b) => [b.category, b.spentDkk])),
    upcomingNext14Days: upcoming,
    forecast: {
      nextSalaryDate: salary,
      lowestSpendableCashBeforeSalaryDkk: round(low.balance),
      lowestOn: low.date,
    },
    notes: [dataSource.fxToDkk.valuationNote, "Saxo total includes its cash; counted once"],
  };
}

function budgetStatus(b: Budget, today: string) {
  const dim = daysInMonth(today);
  const elapsed = dayOfMonth(today);
  const daysLeft = dim - elapsed;
  const projected = dataSource.plannedOnlyCategories.includes(b.category) ? b.spentDkk : (b.spentDkk / elapsed) * dim;
  return {
    category: b.category,
    limitDkk: b.limitDkk,
    spentDkk: b.spentDkk,
    remainingDkk: b.limitDkk - b.spentDkk,
    percentUsed: round((b.spentDkk / b.limitDkk) * 100),
    daysLeftInMonth: daysLeft,
    remainingPerDayDkk: daysLeft > 0 ? round((b.limitDkk - b.spentDkk) / daysLeft) : 0,
    projectedMonthEndDkk: round(projected),
    projectedOverUnderDkk: round(projected - b.limitDkk),
  };
}

function getBudgetStatus(args: { category?: string }) {
  const today = dataSource.today();
  const all = dataSource.budgets();
  const wanted = args.category?.toLowerCase().trim();
  const match = wanted ? all.filter((b) => b.category === wanted || b.category.startsWith(wanted)) : all;
  if (wanted && match.length === 0) {
    return { today, error: `No budget named "${args.category}"`, availableCategories: all.map((b) => b.category) };
  }
  return { today, budgets: match.map((b) => budgetStatus(b, today)) };
}

function getActionItems(args: { status?: "new" | "approved" | "dismissed" | "all" }) {
  const status = args.status ?? "new";
  const items = dataSource.actionItems().filter((i) => status === "all" || i.status === status);
  return {
    status,
    count: items.length,
    items: items.map(({ id, type, title, body, amount, severity, status: s, createdAt }) => ({
      id,
      type,
      title,
      body,
      ...(amount !== undefined ? { amountDkk: amount } : {}),
      severity,
      status: s,
      createdAt,
    })),
  };
}

function explainActionItem(args: { id: string }) {
  const item = dataSource.actionItems().find((i) => i.id === args.id);
  if (!item) {
    return { error: `No action item with id "${args.id}"`, availableIds: dataSource.actionItems().map((i) => i.id) };
  }
  const today = dataSource.today();
  let supporting: Record<string, unknown> = { ...item.facts };
  if (item.type === "budget_alert") {
    const b = dataSource.budgets().find((x) => x.category === item.facts?.category);
    if (b) supporting = { ...supporting, budget: budgetStatus(b, today) };
  }
  if (item.type === "money_routing" && item.amount) {
    const salary = nextSalaryAfter(today);
    const days = forecast(addDays(salary, -1));
    const low = Math.min(...days.map((d) => d.balance));
    supporting = {
      ...supporting,
      nextSalaryDate: salary,
      lowestSpendableCashBeforeSalaryDkk: round(low),
      lowestAfterTransferDkk: round(low - item.amount),
      safetyNetFloorDkk: dataSource.goals().safetyNet.floorDkk,
    };
  }
  return { ...item, supporting };
}

const AFFORD_HORIZON_DAYS = 400;

function canIAfford(args: { amount_dkk: number; date?: string; description: string; category?: string }) {
  const today = dataSource.today();
  const goals = dataSource.goals();
  const floor = goals.safetyNet.floorDkk;
  const amount = args.amount_dkk;

  // Resolve the spending date. A bare month (YYYY-MM) uses its first day: the conservative choice,
  // because the spend then lowers every later day in the forecast.
  let date = today;
  if (args.date && /^\d{4}-\d{2}$/.test(args.date)) date = `${args.date}-01`;
  else if (args.date && /^\d{4}-\d{2}-\d{2}$/.test(args.date)) date = args.date;
  if (date < today) date = today;
  if ((toDate(date).getTime() - toDate(today).getTime()) / DAY_MS > AFFORD_HORIZON_DAYS) {
    return { error: "Date too far ahead to forecast", today, maxDate: addDays(today, AFFORD_HORIZON_DAYS) };
  }

  // Window: spending date up to the day before the next salary (the cash low point).
  const salary = nextSalaryAfter(date);
  const windowEnd = addDays(salary, -1);
  const days = forecast(windowEnd);
  const startBalance = spendableCashDkk();
  const onDate = date === today ? startBalance : (days.find((d) => d.date === date)?.balance ?? startBalance);
  const window = days.filter((d) => d.date >= date);
  const lowWithout = window.length ? window.reduce((m, d) => (d.balance < m.balance ? d : m)) : { date, balance: onDate };
  const lowestWith = Math.min(onDate, lowWithout.balance) - amount;
  const lowestOn = onDate <= lowWithout.balance ? date : lowWithout.date;
  const headroom = lowestWith - floor;

  // Budget for the spend's category in that month (future months start unspent).
  const category = args.category?.toLowerCase();
  const budget = category ? dataSource.budgets().find((b) => b.category === category) : undefined;
  const budgetRemaining = budget ? (sameMonth(date, today) ? budget.limitDkk - budget.spentDkk : budget.limitDkk) : undefined;
  const overBudgetBy = budgetRemaining !== undefined ? Math.max(0, amount - budgetRemaining) : 0;

  const TIGHT_MARGIN = 2_000;
  let verdict: "yes" | "yes_but_over_budget" | "tight" | "no";
  if (lowestWith < floor) verdict = "no";
  else if (headroom < TIGHT_MARGIN) verdict = "tight";
  else if (overBudgetBy > 0) verdict = "yes_but_over_budget";
  else verdict = "yes";

  const surplus = dataSource.actionItems().find((i) => i.type === "money_routing" && i.status === "new");
  return {
    verdict,
    description: args.description,
    amountDkk: amount,
    spendDate: date,
    today,
    spendableCashOnDateDkk: round(onDate),
    nextSalaryDate: salary,
    lowestSpendableCashAfterSpendDkk: round(lowestWith),
    lowestOn,
    safetyNetFloorDkk: floor,
    headroomAboveFloorDkk: round(headroom),
    ...(budget
      ? {
          budget: {
            category: budget.category,
            monthlyLimitDkk: budget.limitDkk,
            remainingInThatMonthDkk: budgetRemaining,
            overBudgetByDkk: overBudgetBy,
          },
        }
      : {}),
    ...(surplus?.amount
      ? {
          pendingSuggestion: {
            title: surplus.title,
            amountDkk: surplus.amount,
            lowestIfAlsoApprovedDkk: round(lowestWith - surplus.amount),
          },
        }
      : {}),
    assumptions: [
      "Forecast assumes spending at budget pace and salary on the last banking day",
      "Spendable cash = DKK everyday accounts; EUR cash and investments excluded",
    ],
  };
}

function getGoals() {
  const g = dataSource.goals();
  const liquid = dataSource
    .accounts()
    .filter((a) => a.kind === "cash")
    .reduce((s, a) => s + toDkk(a), 0);
  const sg = g.savingsGoal;
  const remaining = sg.targetDkk - sg.savedDkk;
  return {
    riskTolerance: g.riskTolerance,
    monthlyNetIncomeDkk: g.monthlyNetIncomeDkk,
    safetyNet: {
      floorDkk: g.safetyNet.floorDkk,
      targetMonths: g.safetyNet.targetMonths,
      targetDkk: g.safetyNet.targetMonths * g.safetyNet.monthlyEssentialsDkk,
      currentCashDkk: round(liquid),
      monthsCovered: Math.round((liquid / g.safetyNet.monthlyEssentialsDkk) * 10) / 10,
    },
    savingsGoal: {
      ...sg,
      remainingDkk: remaining,
      percentDone: round((sg.savedDkk / sg.targetDkk) * 100),
      monthsAtCurrentPace: Math.ceil(remaining / sg.monthlyContributionDkk),
    },
    budgets: Object.fromEntries(dataSource.budgets().map((b) => [b.category, b.limitDkk])),
  };
}

// ---------------------------------------------------------------------------------------------
// Registry: JSON-schema definitions (sent to OpenAI) + zod validation + handlers
// ---------------------------------------------------------------------------------------------

const BUDGET_CATEGORIES = ["groceries", "restaurants", "transport", "shopping", "entertainment", "travel"] as const;

const registry = {
  get_overview: {
    description:
      "Get the user's financial overview: total across banks, cash vs investments, per-account balances, this month's spending by category, bills in the next 14 days, and the cash low point before next salary.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    schema: z.object({}),
    run: () => getOverview(),
  },
  get_budget_status: {
    description:
      "Get this month's budget status (limit, spent, remaining, % used, days left, projected month end). Omit category for all budgets.",
    parameters: {
      type: "object",
      properties: {
        category: { type: "string", enum: [...BUDGET_CATEGORIES], description: "Budget category" },
      },
      additionalProperties: false,
    },
    schema: z.object({ category: z.string().optional() }),
    run: (a: { category?: string }) => getBudgetStatus(a),
  },
  get_action_items: {
    description:
      "List action items from the daily autopilot run (budget alerts, money moves, refinancing). Defaults to new items.",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["new", "approved", "dismissed", "all"], description: "Filter, default new" },
      },
      additionalProperties: false,
    },
    schema: z.object({ status: z.enum(["new", "approved", "dismissed", "all"]).optional() }),
    run: (a: { status?: "new" | "approved" | "dismissed" | "all" }) => getActionItems(a),
  },
  can_i_afford: {
    description:
      "Check whether the user can afford a purchase or trip. Uses the cash forecast to the spend date and until next salary, the safety-net floor, and the category budget. Returns a verdict (yes, yes_but_over_budget, tight, no) with the numbers.",
    parameters: {
      type: "object",
      properties: {
        amount_dkk: { type: "number", description: "Cost in Danish kroner" },
        date: {
          type: "string",
          description: "When the money is spent: YYYY-MM-DD, or YYYY-MM for a whole month. Omit for today.",
        },
        description: { type: "string", description: "What it is, e.g. 'weekend in Lisbon'" },
        category: {
          type: "string",
          enum: [...BUDGET_CATEGORIES],
          description: "Budget category it falls under (trips and holidays: travel)",
        },
      },
      required: ["amount_dkk", "description"],
      additionalProperties: false,
    },
    schema: z.object({
      amount_dkk: z.coerce.number().positive(),
      date: z.string().optional(),
      description: z.string().min(1),
      category: z.string().optional(),
    }),
    run: (a: { amount_dkk: number; date?: string; description: string; category?: string }) => canIAfford(a),
  },
  get_goals: {
    description:
      "Get the user's goals: risk tolerance, income, safety net (floor, target, months covered), savings goal progress, and budget limits.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    schema: z.object({}),
    run: () => getGoals(),
  },
  explain_action_item: {
    description: "Explain one action item: its rationale and the numbers behind it. Use an id from get_action_items.",
    parameters: {
      type: "object",
      properties: { id: { type: "string", description: "Action item id" } },
      required: ["id"],
      additionalProperties: false,
    },
    schema: z.object({ id: z.string().min(1) }),
    run: (a: { id: string }) => explainActionItem(a),
  },
} as const;

export type VoiceToolName = keyof typeof registry;

export function isVoiceToolName(name: string): name is VoiceToolName {
  return Object.hasOwn(registry, name);
}

/** Tool definitions in the Realtime session format. */
export function voiceToolDefinitions() {
  return Object.entries(registry).map(([name, t]) => ({
    type: "function" as const,
    name,
    description: t.description,
    parameters: t.parameters,
  }));
}

export type VoiceToolResult = { ok: true; dataSource: string; result: unknown } | { ok: false; error: string };

/** Validate and run a tool. `rawArgs` may be the model's JSON string or an object. */
export function runVoiceTool(name: string, rawArgs: unknown): VoiceToolResult {
  if (!isVoiceToolName(name)) return { ok: false, error: `Unknown tool "${name}"` };
  let args: unknown = rawArgs ?? {};
  if (typeof args === "string") {
    try {
      args = args.trim() ? JSON.parse(args) : {};
    } catch {
      return { ok: false, error: "Arguments are not valid JSON" };
    }
  }
  const tool = registry[name];
  const parsed = tool.schema.safeParse(args);
  if (!parsed.success) return { ok: false, error: `Invalid arguments: ${parsed.error.message}` };
  // Each handler's argument type matches its own schema.
  const result = (tool.run as (a: unknown) => unknown)(parsed.data);
  return { ok: true, dataSource: dataSource.label, result };
}

/** System instructions for the voice session. Includes the (simulated) date for relative dates. */
export function voiceInstructions() {
  const today = dataSource.today();
  const weekday = toDate(today).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
  return `You are Autopilot, the voice of a personal finance app for ${dataSource.userName}, who lives in Denmark. Today is ${weekday} ${today}. Money is in Danish kroner (kr.).

Language: reply in the language the user speaks. Danish if they speak Danish, otherwise English.

Numbers: never invent, guess, or remember the user's figures. Before answering anything about balances, spending, budgets, bills, goals, action items, or affordability, call a tool and use only the numbers it returns. If no tool has the answer, say you don't have that data.

Affordability: for "can I afford ..." questions call can_i_afford. Convert relative dates such as "next month" using today's date (use YYYY-MM for a whole month) and set the category (trips: travel). If the user gives no price, say a rough typical cost out loud as your own assumption and check that amount; offer to recheck with their real price. Lead with the verdict, then the one or two numbers that matter: what they'd have left at the lowest point versus their safety net, and any budget overrun. If there is a pending savings suggestion, mention the trade-off briefly.

Style: warm, calm, plain words. This is voice, so keep replies to one to three short sentences, no lists, no markdown. Round amounts to the nearest hundred kroner when speaking. Ask at most one follow-up question.

Limits: you can't move money or change settings; approvals happen in the Actions tab. You give general guidance, not regulated financial advice, and you don't recommend specific securities.`;
}
