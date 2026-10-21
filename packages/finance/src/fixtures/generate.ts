/**
 * Deterministic generator for the synthetic persona's provider records.
 *
 * Output is raw provider-shaped data at the import boundary: transactions
 * per account with visibility windows (so a simulated clock can reveal them),
 * Saxo investment events, and holdings. Opening balances are derived so that
 * closing balances at DEMO_DATE match DEMO_DATE_BALANCES exactly.
 *
 * Randomness uses a seeded PRNG; the same seed always yields the same data.
 */
import type {
  CurrencyCode,
  Holding,
  Instrument,
  InvestmentEvent,
  ISODate,
  Transaction,
  TransactionKind,
} from "../types.ts";
import { firstMonthPayment } from "../insights/loan-math.ts";
import {
  createRng,
  eachDay,
  hashString,
  lastBankingDayOfMonth,
  monthKey,
  nextBankingDay,
  round2,
} from "../util.ts";
import {
  ACCOUNT_IDS,
  CONSUMER_LOAN,
  DEMO_DATE,
  DEMO_DATE_BALANCES,
  FIXTURE_END,
  FIXTURE_SEED,
  FX_RATES,
  HISTORY_START,
  MORTGAGE,
  PERSONA,
  SAXO_VALUATION_TIME,
} from "./persona.ts";

/** A provider record before import: no app ID or retrieval time yet. */
export interface FixtureTransaction extends Omit<Transaction, "id" | "retrievedAt"> {
  /** First simulated day the provider returns this record. */
  visibleFrom: ISODate;
  /** Last simulated day the provider returns it (pending records disappear after booking). */
  visibleUntil?: ISODate;
  /** For pending records: the provider ID of the booked record that later replaces it. */
  bookedAsSourceId?: string;
}

export interface FixtureHolding extends Omit<Holding, "retrievedAt" | "quantity" | "marketValue" | "unrealizedPnl"> {
  /** Quantity at DEMO_DATE; earlier quantities are derived from trades. */
  quantityAtDemoDate: number;
  marketValueAtDemoDate: number;
}

export type FixtureInvestmentEvent = Omit<InvestmentEvent, "retrievedAt">;

export interface FixtureStore {
  transactions: FixtureTransaction[];
  investmentEvents: FixtureInvestmentEvent[];
  holdings: FixtureHolding[];
  /** Booked balance at the start of HISTORY_START (before any fixture transaction). */
  openingBalances: Record<string, number>;
}

const EUR_DKK = FX_RATES.find((r) => r.base === "EUR")?.rate ?? 7.46;

type AccountKey = keyof typeof ACCOUNT_IDS;

const ACCOUNT_META: Record<AccountKey, { provider: Transaction["provider"]; sourceAccountId: string; currency: CurrencyCode }> = {
  danskeEveryday: { provider: "danske_bank", sourceAccountId: "8f3c2a71-5d0e-4b8a-9c1d-2e6f0a4b7c11", currency: "DKK" },
  danskeSavings: { provider: "danske_bank", sourceAccountId: "1b9e4d02-77a3-4c5f-8e21-9d0c3f6a5b28", currency: "DKK" },
  revolutDkk: { provider: "revolut", sourceAccountId: "6a1f0c9e-3b7d-4e25-a8f0-5c2d9e1b7a40", currency: "DKK" },
  revolutEur: { provider: "revolut", sourceAccountId: "6a1f0c9e-3b7d-4e25-a8f0-5c2d9e1b7a41", currency: "EUR" },
  saxo: { provider: "saxo", sourceAccountId: "9kQ2xN7vT3aLm8YpR1cB-g==", currency: "DKK" },
};

interface TxInput {
  date: ISODate;
  amount: number;
  description?: string;
  merchantName?: string;
  mcc?: string;
  counterpartyName?: string;
  counterpartyAccount?: string;
  kind?: TransactionKind;
  originalAmount?: { amount: number; currency: CurrencyCode };
  exchangeRate?: number;
  exchangeGroupId?: string;
  reference?: string;
  /** Omit the provider transaction ID (Danske's is optional). */
  noSourceId?: boolean;
  sourceTransactionId?: string;
  status?: "pending" | "booked";
  transactionDate?: ISODate;
  visibleUntil?: ISODate;
  bookedAsSourceId?: string;
}

let seq = 0;

function sourceIdFor(provider: Transaction["provider"], input: TxInput): string {
  seq += 1;
  const h = hashString(`${provider}|${input.date}|${input.amount}|${seq}`);
  switch (provider) {
    case "danske_bank":
      return `DB${input.date.replaceAll("-", "")}${String(seq).padStart(5, "0")}`;
    case "revolut":
      return `${h}-${hashString(h).slice(0, 4)}-4${h.slice(1, 4)}-a${h.slice(4, 7)}-${hashString(String(seq))}${h.slice(0, 4)}`;
    case "saxo":
      return String(5_100_000_000 + seq);
  }
}

function makeTx(account: AccountKey, input: TxInput): FixtureTransaction {
  const meta = ACCOUNT_META[account];
  const status = input.status ?? "booked";
  const tx: FixtureTransaction = {
    provider: meta.provider,
    accountId: ACCOUNT_IDS[account],
    sourceAccountId: meta.sourceAccountId,
    amount: round2(input.amount),
    currency: meta.currency,
    status,
    transactionDate: input.transactionDate ?? input.date,
    origin: "synthetic_fixture",
    visibleFrom: input.transactionDate && status === "pending" ? input.transactionDate : input.date,
  };
  if (status === "booked") {
    tx.bookingDate = input.date;
    tx.valueDate = input.date;
  }
  const sid = input.noSourceId ? undefined : (input.sourceTransactionId ?? sourceIdFor(meta.provider, input));
  if (sid) tx.sourceTransactionId = sid;
  if (input.description !== undefined) tx.description = input.description;
  if (input.merchantName !== undefined) tx.merchantName = input.merchantName;
  if (input.mcc !== undefined) tx.mcc = input.mcc;
  if (input.counterpartyName !== undefined) tx.counterpartyName = input.counterpartyName;
  if (input.counterpartyAccount !== undefined) tx.counterpartyAccount = input.counterpartyAccount;
  if (input.kind !== undefined) tx.kind = input.kind;
  if (input.originalAmount !== undefined) tx.originalAmount = input.originalAmount;
  if (input.exchangeRate !== undefined) tx.exchangeRate = input.exchangeRate;
  if (input.exchangeGroupId !== undefined) tx.exchangeGroupId = input.exchangeGroupId;
  if (input.reference !== undefined) tx.reference = input.reference;
  if (input.visibleUntil !== undefined) tx.visibleUntil = input.visibleUntil;
  if (input.bookedAsSourceId !== undefined) tx.bookedAsSourceId = input.bookedAsSourceId;
  return tx;
}

// ---------------------------------------------------------------------------
// Merchant catalogue (Danish merchants; Danske card lines carry MCC sometimes)
// ---------------------------------------------------------------------------

interface MerchantDef {
  name: string;
  descr: string;
  mcc: string;
  min: number;
  max: number;
}

const GROCERY: MerchantDef[] = [
  { name: "Netto", descr: "NETTO VALBY", mcc: "5411", min: 45, max: 290 },
  { name: "Rema 1000", descr: "REMA 1000 TOFTEGARDS PL", mcc: "5411", min: 60, max: 340 },
  { name: "Føtex", descr: "FOETEX VALBY", mcc: "5411", min: 120, max: 520 },
  { name: "Lidl", descr: "LIDL DANMARK K/S", mcc: "5411", min: 70, max: 310 },
  { name: "Meny", descr: "MENY FREDERIKSBERG", mcc: "5411", min: 140, max: 560 },
  { name: "Coop 365", descr: "COOP 365 VALBY", mcc: "5411", min: 50, max: 260 },
];

const RESTAURANTS: MerchantDef[] = [
  { name: "Original Coffee", descr: "ORIGINAL COFFEE", mcc: "5814", min: 42, max: 78 },
  { name: "Joe & The Juice", descr: "JOE AND THE JUICE", mcc: "5814", min: 55, max: 95 },
  { name: "Gasoline Grill", descr: "GASOLINE GRILL", mcc: "5814", min: 110, max: 190 },
  { name: "Hija de Sanchez", descr: "HIJA DE SANCHEZ", mcc: "5812", min: 120, max: 240 },
  { name: "Madklubben", descr: "MADKLUBBEN VESTERBRO", mcc: "5812", min: 280, max: 520 },
  { name: "Mikkeller Bar", descr: "MIKKELLER BAR", mcc: "5813", min: 140, max: 310 },
];

const TRANSPORT: MerchantDef[] = [
  { name: "DOT Rejsekort", descr: "REJSEKORT AUTOTANK", mcc: "4111", min: 200, max: 200 },
  { name: "DSB", descr: "DSB BILLETAUTOMAT", mcc: "4112", min: 96, max: 340 },
  { name: "Donkey Republic", descr: "DONKEY REPUBLIC", mcc: "7999", min: 25, max: 48 },
];

const SHOPPING: MerchantDef[] = [
  { name: "H&M", descr: "H&M STROEGET", mcc: "5651", min: 149, max: 499 },
  { name: "Magasin", descr: "MAGASIN DU NORD", mcc: "5311", min: 199, max: 899 },
  { name: "Normal", descr: "NORMAL VALBY", mcc: "5331", min: 39, max: 189 },
  { name: "Søstrene Grene", descr: "SOSTRENE GRENE", mcc: "5719", min: 45, max: 230 },
  { name: "IKEA", descr: "IKEA TAASTRUP", mcc: "5712", min: 120, max: 780 },
];

const HEALTH: MerchantDef[] = [
  { name: "Matas", descr: "MATAS VALBY", mcc: "5977", min: 59, max: 260 },
  { name: "Apotek", descr: "VALBY APOTEK", mcc: "5912", min: 35, max: 180 },
];

const ENTERTAINMENT: MerchantDef[] = [
  { name: "Nordisk Film Biografer", descr: "NORDISK FILM BIOGRAFER", mcc: "7832", min: 135, max: 270 },
  { name: "Tivoli", descr: "TIVOLI A/S", mcc: "7996", min: 160, max: 340 },
];

function pick<T>(rng: () => number, items: readonly T[]): T {
  const item = items[Math.floor(rng() * items.length)];
  if (item === undefined) throw new Error("empty pick");
  return item;
}

function amountBetween(rng: () => number, min: number, max: number): number {
  if (min === max) return min;
  // Card amounts in DKK usually end in .00, .50 or .95 at Danish merchants.
  const raw = min + rng() * (max - min);
  const endings = [0, 0.5, 0.95, 0.75, 0.25];
  return Math.floor(raw) + (pick(rng, endings) ?? 0);
}

function danskeCard(m: MerchantDef, date: ISODate, amount: number, rng: () => number): TxInput {
  // ~15% of Danske card lines have no merchant name (optional field) but keep the raw description.
  // ~10% have no provider transaction ID (optional in Danske's schema).
  const hasMerchant = rng() > 0.15;
  const hasMcc = rng() > 0.3;
  const noId = rng() < 0.1;
  const input: TxInput = {
    date,
    amount: -amount,
    description: `Dankort-køb ${m.descr} ${date.slice(8, 10)}.${date.slice(5, 7)}`,
    kind: "card_payment",
    noSourceId: noId,
  };
  if (hasMerchant) input.merchantName = m.name;
  if (hasMcc) input.mcc = m.mcc;
  return input;
}

function revolutCard(m: MerchantDef, date: ISODate, amount: number): TxInput {
  return { date, amount: -amount, description: m.name, merchantName: m.name, kind: "card_payment" };
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

export function generateFixtureStore(): FixtureStore {
  seq = 0;
  const rng = createRng(FIXTURE_SEED);
  const txs: FixtureTransaction[] = [];
  const add = (account: AccountKey, input: TxInput) => {
    txs.push(makeTx(account, input));
  };

  const days = eachDay(HISTORY_START, FIXTURE_END);
  const months = [...new Set(days.map(monthKey))];

  // --- Salary: last banking day of each month -----------------------------
  for (const m of months) {
    const payday = lastBankingDayOfMonth(`${m}-01`);
    if (payday < HISTORY_START || payday > FIXTURE_END) continue;
    add("danskeEveryday", {
      date: payday,
      amount: PERSONA.netMonthlySalary,
      description: `LØN ${PERSONA.employer}`,
      counterpartyName: PERSONA.employer,
      kind: "salary",
    });
  }

  // --- Monthly bills on Danske (Betalingsservice / card), first banking day or fixed day
  const mortgagePayment = firstMonthPayment({
    balance: MORTGAGE.balance,
    annualRate: MORTGAGE.couponRate,
    months: MORTGAGE.remainingTermMonths,
    contributionRate: MORTGAGE.contributionRate,
  });
  const loanPayment = firstMonthPayment({
    balance: CONSUMER_LOAN.balance,
    annualRate: CONSUMER_LOAN.rate,
    months: CONSUMER_LOAN.remainingTermMonths,
  });
  const electricity: Record<string, number> = { "2026-08": 612.4, "2026-09": 588.75, "2026-10": 655.1, "2026-11": 701.3 };
  for (const m of months) {
    const first = nextBankingDay(`${m}-01`);
    const inWindow = (d: ISODate) => d >= HISTORY_START && d <= FIXTURE_END;
    if (inWindow(first)) {
      add("danskeEveryday", {
        date: first,
        amount: -mortgagePayment,
        description: "BS TOTALKREDIT LÅN 7231-884512",
        counterpartyName: "Totalkredit A/S",
        kind: "direct_debit",
      });
      add("danskeEveryday", {
        date: first,
        amount: -2_350,
        description: "BS E/F VALBY BAKKE FÆLLESUDGIFTER",
        counterpartyName: "E/F Valby Bakke",
        kind: "direct_debit",
      });
      // Standing order to savings (internal)
      add("danskeEveryday", {
        date: first,
        amount: -2_000,
        description: "Fast overførsel Opsparing",
        counterpartyName: "Sofie Jensen",
        counterpartyAccount: "DK** **** **** 9052",
        kind: "standing_order",
      });
      add("danskeSavings", {
        date: first,
        amount: 2_000,
        description: "Fast overførsel fra Danske Konto",
        counterpartyName: "Sofie Jensen",
        counterpartyAccount: "DK** **** **** 4417",
        kind: "standing_order",
      });
      // Monthly Revolut card top-up: appears as a card payment at Danske
      add("danskeEveryday", {
        date: first,
        amount: -2_000,
        description: "Dankort-køb REVOLUT**2291* DUBLIN",
        merchantName: "Revolut",
        kind: "card_payment",
      });
      add("revolutDkk", {
        date: first,
        amount: 2_000,
        description: "Top-Up by *4417",
        kind: "transfer",
      });
    }
    const card1 = `${m}-01`;
    if (inWindow(card1)) {
      add("danskeEveryday", {
        date: card1,
        amount: -389,
        description: `Dankort-køb SATS DANMARK ${card1.slice(8, 10)}.${card1.slice(5, 7)}`,
        merchantName: "SATS",
        mcc: "7997",
        kind: "card_payment",
      });
    }
    const bills: { day: string; amount: number; description: string; counterparty: string; kind: TransactionKind; merchant?: string }[] = [
      { day: "05", amount: -299, description: "BS HIPER A/S", counterparty: "Hiper A/S", kind: "direct_debit" },
      { day: "08", amount: -149, description: "BS TELMORE", counterparty: "Telmore A/S", kind: "direct_debit" },
      { day: "10", amount: -(electricity[m] ?? 640), description: "BS ANDEL ENERGI", counterparty: "Andel Energi A/S", kind: "direct_debit" },
      { day: "15", amount: -465, description: "BS TRYG FORSIKRING", counterparty: "Tryg Forsikring A/S", kind: "direct_debit" },
      { day: "25", amount: -loanPayment, description: "BS KVIK FINANS AFDRAG", counterparty: "Kvik Finans", kind: "direct_debit" },
    ];
    for (const b of bills) {
      const d = nextBankingDay(`${m}-${b.day}`);
      if (inWindow(d)) {
        add("danskeEveryday", { date: d, amount: b.amount, description: b.description, counterpartyName: b.counterparty, kind: b.kind });
      }
    }
    // Netflix on the 23rd (Danske card). Price rises from 129 to 149 in October 2026.
    const netflixDay = `${m}-23`;
    if (inWindow(netflixDay)) {
      add("danskeEveryday", {
        date: netflixDay,
        amount: m >= "2026-10" ? -149 : -129,
        description: `Visa/Dankort NETFLIX.COM ${netflixDay.slice(8, 10)}.${netflixDay.slice(5, 7)}`,
        merchantName: "Netflix",
        mcc: "4899",
        kind: "card_payment",
      });
    }
    // Revolut subscriptions
    const spotify = `${m}-12`;
    if (inWindow(spotify)) add("revolutDkk", { date: spotify, amount: -119, description: "Spotify", merchantName: "Spotify", kind: "card_payment" });
    const icloud = `${m}-06`;
    if (inWindow(icloud)) add("revolutDkk", { date: icloud, amount: -29, description: "Apple.com/bill", merchantName: "Apple", kind: "card_payment" });
  }

  // --- Random everyday spending -------------------------------------------
  for (const date of days) {
    const pre = date <= DEMO_DATE;
    // Groceries (Danske, ~55% of days)
    if (rng() < 0.55) {
      const m = pick(rng, GROCERY);
      add("danskeEveryday", danskeCard(m, date, amountBetween(rng, m.min, m.max), rng));
    }
    // Transport
    if (rng() < 0.11) {
      const m = TRANSPORT[0];
      if (m) add("danskeEveryday", danskeCard(m, date, rng() < 0.5 ? 200 : 300, rng));
    }
    if (rng() < 0.04) {
      const m = pick(rng, TRANSPORT.slice(1));
      add("danskeEveryday", danskeCard(m, date, amountBetween(rng, m.min, m.max), rng));
    }
    // Shopping / health / entertainment: random only up to the demo date; scripted after.
    if (pre && rng() < 0.08) {
      const m = pick(rng, SHOPPING);
      add("danskeEveryday", danskeCard(m, date, amountBetween(rng, m.min, m.max), rng));
    }
    if (pre && rng() < 0.05) {
      const m = pick(rng, HEALTH);
      add("danskeEveryday", danskeCard(m, date, amountBetween(rng, m.min, m.max), rng));
    }
    if (pre && rng() < 0.03) {
      const m = pick(rng, ENTERTAINMENT);
      add("revolutDkk", revolutCard(m, date, amountBetween(rng, m.min, m.max)));
    }
  }

  // --- Restaurants: random visits, then a balancing dinner per full month ---
  // Monthly targets make the auto-budget proposal deterministic (avg 2,800 -> 2,500 after a 10% trim).
  const restaurantTargets: Record<string, number> = { "2026-08": 2_860, "2026-09": 2_740 };
  const restaurantTotals: Record<string, number> = {};
  const addRestaurant = (account: AccountKey, input: TxInput, dkk: number) => {
    add(account, input);
    const k = monthKey(input.date);
    restaurantTotals[k] = round2((restaurantTotals[k] ?? 0) + dkk);
  };
  for (const date of eachDay(HISTORY_START, "2026-09-30")) {
    if (rng() < 0.3) {
      const m = pick(rng, RESTAURANTS.slice(0, 4));
      const amt = amountBetween(rng, m.min, m.max);
      if (rng() < 0.5) addRestaurant("danskeEveryday", danskeCard(m, date, amt, rng), amt);
      else addRestaurant("revolutDkk", revolutCard(m, date, amt), amt);
    }
  }
  // Edge case: foreign-currency purchase on the DKK account (SEK at a Malmö food hall)
  const sek = 389;
  const sekRate = FX_RATES.find((r) => r.base === "SEK")?.rate ?? 0.6561;
  addRestaurant(
    "revolutDkk",
    {
      date: "2026-08-22",
      amount: -round2(sek * sekRate),
      description: "Malmö Saluhall",
      merchantName: "Malmö Saluhall",
      kind: "card_payment",
      originalAmount: { amount: -sek, currency: "SEK" },
      exchangeRate: sekRate,
    },
    round2(sek * sekRate),
  );
  // Berlin weekend on the EUR account (restaurant parts count toward September)
  addRestaurant("revolutEur", { date: "2026-09-12", amount: -38.5, description: "Markthalle Neun", merchantName: "Markthalle Neun", kind: "card_payment" }, round2(38.5 * EUR_DKK));
  addRestaurant("revolutEur", { date: "2026-09-12", amount: -14.2, description: "Café Einstein Stammhaus", merchantName: "Café Einstein", kind: "card_payment" }, round2(14.2 * EUR_DKK));
  add("revolutEur", { date: "2026-09-13", amount: -9.9, description: "BVG Ticket", merchantName: "BVG", kind: "card_payment" });
  add("revolutEur", { date: "2026-09-13", amount: -42, description: "Dussmann das KulturKaufhaus", merchantName: "Dussmann", kind: "card_payment" });

  for (const [m, target] of Object.entries(restaurantTargets)) {
    const missing = round2(target - (restaurantTotals[m] ?? 0));
    if (missing > 0) {
      addRestaurant(
        "revolutDkk",
        { date: `${m}-26`, amount: -missing, description: "Madklubben Vesterbro", merchantName: "Madklubben", kind: "card_payment" },
        missing,
      );
    }
  }

  // October restaurants are scripted so the time skip produces a clear budget story.
  const octoberRestaurants: [ISODate, AccountKey, string, number][] = [
    ["2026-10-02", "danskeEveryday", "Original Coffee", 52],
    ["2026-10-03", "revolutDkk", "Madklubben", 385],
    ["2026-10-07", "danskeEveryday", "Joe & The Juice", 69],
    ["2026-10-10", "revolutDkk", "Wolt", 214],
    ["2026-10-14", "danskeEveryday", "Original Coffee", 48],
    ["2026-10-16", "revolutDkk", "Hija de Sanchez", 178],
    ["2026-10-17", "revolutDkk", "Mikkeller Bar", 245],
    // after DEMO_DATE
    ["2026-10-20", "revolutDkk", "Wolt", 189],
    ["2026-10-21", "revolutDkk", "Bæst", 765],
    ["2026-10-24", "danskeEveryday", "Gasoline Grill", 142],
    ["2026-10-27", "danskeEveryday", "Original Coffee", 55],
    ["2026-10-29", "revolutDkk", "Wolt", 245],
    ["2026-11-01", "revolutDkk", "Lagkagehuset", 74],
  ];
  for (const [date, account, name, amt] of octoberRestaurants) {
    if (account === "danskeEveryday") {
      add(account, { date, amount: -amt, description: `Dankort-køb ${name.toUpperCase()} ${date.slice(8, 10)}.${date.slice(5, 7)}`, merchantName: name, mcc: "5814", kind: "card_payment" });
    } else {
      add(account, { date, amount: -amt, description: name, merchantName: name, kind: "card_payment" });
    }
  }

  // --- Edge cases ----------------------------------------------------------
  // Danske -> Revolut bank transfer of DKK 1,000 (not spend, not income)
  add("danskeEveryday", {
    date: "2026-10-09",
    amount: -1_000,
    description: "Overførsel til Revolut",
    counterpartyName: "Sofie Jensen",
    counterpartyAccount: "LT** **** **** **** 2291",
    kind: "transfer",
  });
  add("revolutDkk", {
    date: "2026-10-09",
    amount: 1_000,
    description: "Payment from SOFIE JENSEN",
    counterpartyName: "SOFIE JENSEN",
    kind: "transfer",
  });
  // Danske -> Saxo deposit
  add("danskeEveryday", {
    date: "2026-08-05",
    amount: -2_000,
    description: "Overførsel til Saxo Bank",
    counterpartyName: "Saxo Bank A/S",
    kind: "transfer",
  });
  // Revolut internal FX exchange DKK -> EUR
  const eurBought = round2(1_500 / EUR_DKK);
  add("revolutDkk", {
    date: "2026-09-09",
    amount: -1_500,
    description: "Exchanged to EUR",
    kind: "fx_exchange",
    exchangeGroupId: "rev-fx-20260909-01",
  });
  add("revolutEur", {
    date: "2026-09-09",
    amount: eurBought,
    description: "Exchanged from DKK",
    kind: "fx_exchange",
    exchangeGroupId: "rev-fx-20260909-01",
    originalAmount: { amount: 1_500, currency: "DKK" },
    exchangeRate: EUR_DKK,
  });
  // Refund: Zalando purchase and refund
  add("revolutDkk", { date: "2026-09-04", amount: -599, description: "Zalando", merchantName: "Zalando", kind: "card_payment" });
  add("revolutDkk", { date: "2026-09-18", amount: 599, description: "Refund from Zalando", merchantName: "Zalando", kind: "refund" });
  // No merchant detail, raw description only (stays uncategorized)
  add("danskeEveryday", { date: "2026-09-14", amount: -312, description: "VISA/DANKORT 7834 13.09", kind: "card_payment", noSourceId: true });
  // Ambiguous MobilePay person-to-person payments (stay uncategorized)
  add("danskeEveryday", { date: "2026-08-16", amount: 350, description: "MobilePay: Mikkel Holm", counterpartyName: "Mikkel Holm", kind: "mobilepay" });
  add("danskeEveryday", { date: "2026-09-27", amount: -200, description: "MobilePay: Mikkel Holm", counterpartyName: "Mikkel Holm", kind: "mobilepay" });
  // Cash withdrawal
  add("danskeEveryday", { date: "2026-08-29", amount: -500, description: "Hæveautomat VALBY LANGGADE", kind: "other" });
  // Pending DKK 249 at Matas: pending Oct 18, books Oct 20 with a NEW ID; on Oct 20 the provider still returns both.
  add("revolutDkk", {
    date: "2026-10-18",
    transactionDate: "2026-10-18",
    status: "pending",
    amount: -249,
    description: "Matas",
    merchantName: "Matas",
    kind: "card_payment",
    visibleUntil: "2026-10-20",
    sourceTransactionId: "c41e9a07-pend-4b11-9f3e-2a7d10c5e249",
    bookedAsSourceId: "7be20f56-book-4c2a-8d01-93f6e5a1b249",
  });
  add("revolutDkk", {
    date: "2026-10-20",
    transactionDate: "2026-10-18",
    amount: -249,
    description: "Matas",
    merchantName: "Matas",
    kind: "card_payment",
    sourceTransactionId: "7be20f56-book-4c2a-8d01-93f6e5a1b249",
  });

  // --- Scripted post-demo activity -----------------------------------------
  // Possible duplicate: Elgiganten twice, same day, same amount
  add("danskeEveryday", { date: "2026-10-22", amount: -1_299, description: "Dankort-køb ELGIGANTEN FISKETORVET 22.10", merchantName: "Elgiganten", mcc: "5732", kind: "card_payment" });
  add("danskeEveryday", { date: "2026-10-22", amount: -1_299, description: "Dankort-køb ELGIGANTEN FISKETORVET 22.10", merchantName: "Elgiganten", mcc: "5732", kind: "card_payment" });
  add("danskeEveryday", { date: "2026-10-25", amount: -159, description: "Dankort-køb MATAS VALBY 25.10", merchantName: "Matas", mcc: "5977", kind: "card_payment" });
  add("danskeEveryday", { date: "2026-10-31", amount: -229, description: "Dankort-køb NORMAL VALBY 31.10", merchantName: "Normal", mcc: "5331", kind: "card_payment" });

  // --- Saxo: cash movements as transactions + structured investment events
  const saxoEvents: FixtureInvestmentEvent[] = [];
  const saxoEvent = (e: Omit<FixtureInvestmentEvent, "accountId" | "provider" | "currency" | "origin">, kind: TransactionKind) => {
    const full: FixtureInvestmentEvent = { ...e, accountId: ACCOUNT_IDS.saxo, provider: "saxo", currency: "DKK", origin: "synthetic_fixture" };
    saxoEvents.push(full);
    add("saxo", {
      date: e.valueDate,
      amount: e.cashAmount,
      description: e.description,
      kind,
      sourceTransactionId: e.id,
      ...(e.relatedEventId ? { reference: e.relatedEventId } : {}),
    });
  };
  saxoEvent({ id: "5100912201", type: "deposit", tradeDate: "2026-08-06", valueDate: "2026-08-06", cashAmount: 2_000, description: "Cash deposit from DK** **** **** 4417" }, "investment_deposit");
  saxoEvent({ id: "5100934417", type: "dividend", tradeDate: "2026-08-12", valueDate: "2026-08-14", cashAmount: 356.25, instrumentSymbol: "NOVO B:xcse", quantity: 95, price: 3.75, description: "Interim dividend Novo Nordisk B, DKK 3.75 x 95" }, "investment_dividend");
  saxoEvent({ id: "5100934418", type: "withholding_tax", tradeDate: "2026-08-12", valueDate: "2026-08-14", cashAmount: -96.19, instrumentSymbol: "NOVO B:xcse", relatedEventId: "5100934417", description: "Withholding tax 27% on Novo Nordisk B dividend" }, "investment_tax");
  saxoEvent({ id: "5100951120", type: "trade_buy", tradeDate: "2026-08-31", valueDate: "2026-09-02", cashAmount: -2_770, instrumentSymbol: "DSV:xcse", quantity: 2, price: 1_385, description: "Bought 2 DSV A/S @ 1,385.00" }, "investment_trade");
  saxoEvent({ id: "5100951121", type: "fee", tradeDate: "2026-08-31", valueDate: "2026-09-02", cashAmount: -14, instrumentSymbol: "DSV:xcse", relatedEventId: "5100951120", description: "Commission DSV A/S" }, "investment_fee");

  // --- Holdings at DEMO_DATE (values in DKK sum to 95,000) -----------------
  const instruments: { instrument: Instrument; qty: number; value: number; cost: number }[] = [
    { instrument: { symbol: "NOVO B:xcse", name: "Novo Nordisk B", isin: "DK0062498333", assetClass: "equity", currency: "DKK", country: "DK", exchange: "XCSE" }, qty: 95, value: 34_200, cost: 45_125 },
    { instrument: { symbol: "EUNL:xetr", name: "iShares Core MSCI World UCITS ETF", isin: "IE00B4L5Y983", assetClass: "equity_fund", currency: "EUR", country: "GLOBAL", exchange: "XETR" }, qty: 55, value: 43_000, cost: 36_400 },
    { instrument: { symbol: "DSV:xcse", name: "DSV A/S", isin: "DK0060079531", assetClass: "equity", currency: "DKK", country: "DK", exchange: "XCSE" }, qty: 7, value: 9_800, cost: 9_310 },
    { instrument: { symbol: "DIMLO:xcse", name: "Danish mid-duration bond fund (sample)", assetClass: "bond_fund", currency: "DKK", country: "DK", exchange: "XCSE" }, qty: 80, value: 8_000, cost: 7_920 },
  ];
  const holdings: FixtureHolding[] = instruments.map(({ instrument, qty, value, cost }) => ({
    accountId: ACCOUNT_IDS.saxo,
    provider: "saxo",
    instrument,
    quantityAtDemoDate: qty,
    price: round2((value / qty / (instrument.currency === "EUR" ? EUR_DKK : 1)) * 100) / 100,
    marketValueAtDemoDate: value,
    accountCurrency: "DKK",
    costBasis: cost,
    valuationTime: SAXO_VALUATION_TIME,
    origin: "synthetic_fixture",
  }));

  // --- Opening balances so closing booked balance at DEMO_DATE matches the targets
  const openingBalances: Record<string, number> = {};
  for (const [accountId, closing] of Object.entries(DEMO_DATE_BALANCES)) {
    const flows = txs
      .filter((t) => t.accountId === accountId && t.status === "booked" && (t.bookingDate ?? "") <= DEMO_DATE)
      .reduce((a, t) => a + t.amount, 0);
    openingBalances[accountId] = round2(closing - flows);
  }

  txs.sort((a, b) => (a.visibleFrom < b.visibleFrom ? -1 : a.visibleFrom > b.visibleFrom ? 1 : 0));
  return { transactions: txs, investmentEvents: saxoEvents, holdings, openingBalances };
}

let cached: FixtureStore | undefined;

/** Memoised fixture store (generation is deterministic). */
export function getFixtureStore(): FixtureStore {
  cached ??= generateFixtureStore();
  return cached;
}
