/**
 * Fixture connectors. They implement the same `Connector` interface a real
 * Enable Banking (Danske Bank, Revolut) or Saxo OpenAPI connector would, and
 * return synthetic records visible at the simulated clock's `asOf`.
 *
 * Replace `DanskeBankFixtureConnector` / `RevolutFixtureConnector` with an
 * `EnableBankingConnector`, and `SaxoFixtureConnector` with a
 * `SaxoOpenApiConnector`, without touching the insights.
 */
import type {
  Account,
  Balance,
  ConnectionStatus,
  Connector,
  DataOrigin,
  DateRange,
  Holding,
  InvestmentEvent,
  ISODate,
  Provider,
  Transaction,
} from "../types.ts";
import { ConnectorError } from "../types.ts";
import { getFixtureStore } from "../fixtures/generate.ts";
import type { FixtureStore, FixtureTransaction } from "../fixtures/generate.ts";
import { CONNECTIONS, DEMO_DATE, FIXTURE_ACCOUNTS, FX_RATES, SAXO_VALUATION_TIME, SYNTHETIC_LABEL } from "../fixtures/persona.ts";
import { addDays, retrievalTime, round2 } from "../util.ts";
import { assignTransactionIds } from "./import.ts";

export interface FixtureScenario {
  name: string;
  /** Last day each provider's consent is valid. After it, calls reject with `consent_expired`. */
  consentValidUntil?: Partial<Record<Provider, ISODate>>;
  /** Providers that reject with `bank_unavailable` (always, or on the listed days). */
  unavailable?: Partial<Record<Provider, true | ISODate[]>>;
}

export const FIXTURE_SCENARIOS = {
  healthy: { name: "healthy" },
  /** Revolut consent lapses after 2026-10-24; later loads keep the last retrieved Revolut data as stale. */
  revolutConsentExpired: { name: "revolutConsentExpired", consentValidUntil: { revolut: "2026-10-24" } },
  /** Saxo does not respond at all. */
  saxoUnavailable: { name: "saxoUnavailable", unavailable: { saxo: true } },
} as const satisfies Record<string, FixtureScenario>;

export interface FixtureConnectorOptions {
  /** Simulated clock: the current `asOf` day (end of day). */
  clock: () => ISODate;
  scenario?: FixtureScenario;
  store?: FixtureStore;
}

/** Day the persona granted consent in onboarding. */
const CONSENT_GRANTED_AT = `${DEMO_DATE}T08:20:00.000Z`;
const DEFAULT_CONSENT_DAYS: Record<Provider, number> = { danske_bank: 180, revolut: 90, saxo: 90 };

function txDate(t: FixtureTransaction): ISODate {
  return t.status === "booked" ? (t.bookingDate ?? t.transactionDate) : t.transactionDate;
}

function isVisible(t: FixtureTransaction, asOf: ISODate): boolean {
  return t.visibleFrom <= asOf && (t.visibleUntil === undefined || asOf <= t.visibleUntil);
}

function stripFixtureFields(t: FixtureTransaction): Omit<Transaction, "id" | "retrievedAt"> {
  const { visibleFrom: _vf, visibleUntil: _vu, bookedAsSourceId: _b, ...rest } = t;
  return rest;
}

abstract class FixtureConnectorBase implements Connector {
  abstract readonly connectionId: string;
  abstract readonly provider: Provider;
  abstract readonly displayName: string;
  readonly origin: DataOrigin = "synthetic_fixture";
  protected readonly clock: () => ISODate;
  protected readonly scenario: FixtureScenario;
  protected readonly store: FixtureStore;

  constructor(options: FixtureConnectorOptions) {
    this.clock = options.clock;
    this.scenario = options.scenario ?? FIXTURE_SCENARIOS.healthy;
    this.store = options.store ?? getFixtureStore();
  }

  protected consentValidUntil(): ISODate {
    return this.scenario.consentValidUntil?.[this.provider] ?? addDays(DEMO_DATE, DEFAULT_CONSENT_DAYS[this.provider]);
  }

  /** Throws the provider-shaped error the real API would produce for this scenario. */
  protected guard(): ISODate {
    const asOf = this.clock();
    const unavailable = this.scenario.unavailable?.[this.provider];
    if (unavailable === true || (Array.isArray(unavailable) && unavailable.includes(asOf))) {
      throw new ConnectorError("bank_unavailable", this.provider, `${this.displayName} did not respond (simulated outage).`);
    }
    const validUntil = this.consentValidUntil();
    if (asOf > validUntil) {
      throw new ConnectorError(
        "consent_expired",
        this.provider,
        `${this.displayName} consent expired after ${validUntil}. Reconnect to refresh data.`,
        retrievalTime(validUntil),
      );
    }
    return asOf;
  }

  async getStatus(): Promise<ConnectionStatus> {
    const base: ConnectionStatus = {
      connectionId: this.connectionId,
      provider: this.provider,
      state: "connected",
      label: SYNTHETIC_LABEL,
      origin: this.origin,
      consentGrantedAt: CONSENT_GRANTED_AT,
      consentExpiresAt: `${this.consentValidUntil()}T23:59:59.000Z`,
    };
    try {
      const asOf = this.guard();
      return { ...base, lastSuccessfulRetrievalAt: retrievalTime(asOf) };
    } catch (e) {
      if (e instanceof ConnectorError) {
        const status: ConnectionStatus = { ...base, state: e.code === "consent_expired" ? "consent_expired" : e.code === "bank_unavailable" ? "bank_unavailable" : "error", message: e.message };
        if (e.lastSuccessfulRetrievalAt) status.lastSuccessfulRetrievalAt = e.lastSuccessfulRetrievalAt;
        return status;
      }
      throw e;
    }
  }

  protected ownAccounts() {
    return FIXTURE_ACCOUNTS.filter((a) => a.connectionId === this.connectionId);
  }

  async listAccounts(): Promise<Account[]> {
    const asOf = this.guard();
    return this.ownAccounts().map((a) => ({ ...a, retrievedAt: retrievalTime(asOf) }));
  }

  protected bookedBalance(accountId: string, asOf: ISODate): number {
    const opening = this.store.openingBalances[accountId] ?? 0;
    const flows = this.store.transactions
      .filter((t) => t.accountId === accountId && t.status === "booked" && txDate(t) <= asOf)
      .reduce((a, t) => a + t.amount, 0);
    return round2(opening + flows);
  }

  /** Open reservations: pending records visible at asOf whose booked replacement has not booked yet. */
  protected reservations(accountId: string, asOf: ISODate): number {
    const bookedIds = new Set(
      this.store.transactions
        .filter((t) => t.accountId === accountId && t.status === "booked" && txDate(t) <= asOf)
        .map((t) => t.sourceTransactionId),
    );
    return round2(
      this.store.transactions
        .filter((t) => t.accountId === accountId && t.status === "pending" && isVisible(t, asOf))
        .filter((t) => !(t.bookedAsSourceId && bookedIds.has(t.bookedAsSourceId)))
        .reduce((a, t) => a + t.amount, 0),
    );
  }

  async getBalances(accountId?: string): Promise<Balance[]> {
    const asOf = this.guard();
    const retrievedAt = retrievalTime(asOf);
    const out: Balance[] = [];
    for (const a of this.ownAccounts()) {
      if (accountId && a.id !== accountId) continue;
      const booked = this.bookedBalance(a.id, asOf);
      const common = { accountId: a.id, provider: a.provider, sourceAccountId: a.sourceAccountId, currency: a.currency, retrievedAt, origin: this.origin };
      out.push({ ...common, type: "booked", amount: booked, referenceTime: retrievedAt });
      out.push({ ...common, type: "available", amount: round2(booked + this.reservations(a.id, asOf)), referenceTime: retrievedAt });
    }
    return out;
  }

  async getTransactions(range: DateRange): Promise<Transaction[]> {
    const asOf = this.guard();
    const ids = new Set(this.ownAccounts().map((a) => a.id));
    const visible = this.store.transactions
      .filter((t) => ids.has(t.accountId) && isVisible(t, asOf))
      .filter((t) => txDate(t) >= range.from && txDate(t) <= range.to)
      .map(stripFixtureFields);
    return assignTransactionIds(visible, retrievalTime(asOf));
  }
}

export class DanskeBankFixtureConnector extends FixtureConnectorBase {
  readonly connectionId = CONNECTIONS.danske;
  readonly provider = "danske_bank" as const;
  readonly displayName = "Danske Bank";
}

export class RevolutFixtureConnector extends FixtureConnectorBase {
  readonly connectionId = CONNECTIONS.revolut;
  readonly provider = "revolut" as const;
  readonly displayName = "Revolut";
}

export class SaxoFixtureConnector extends FixtureConnectorBase {
  readonly connectionId = CONNECTIONS.saxo;
  readonly provider = "saxo" as const;
  readonly displayName = "Saxo Bank";

  private quantityAt(symbol: string, quantityAtDemoDate: number, asOf: ISODate): number {
    // Undo trades that happened after asOf (only relevant when asOf < DEMO_DATE).
    let q = quantityAtDemoDate;
    for (const e of this.store.investmentEvents) {
      if (e.instrumentSymbol !== symbol || e.tradeDate <= asOf || e.tradeDate > DEMO_DATE) continue;
      if (e.type === "trade_buy") q -= e.quantity ?? 0;
      if (e.type === "trade_sell") q += e.quantity ?? 0;
    }
    return q;
  }

  async getHoldings(): Promise<Holding[]> {
    const asOf = this.guard();
    const retrievedAt = retrievalTime(asOf);
    return this.store.holdings
      .map((h) => {
        const quantity = this.quantityAt(h.instrument.symbol, h.quantityAtDemoDate, asOf);
        const ratio = quantity / h.quantityAtDemoDate;
        const marketValue = round2(h.marketValueAtDemoDate * ratio);
        const { quantityAtDemoDate: _q, marketValueAtDemoDate: _m, ...rest } = h;
        const holding: Holding = {
          ...rest,
          quantity,
          marketValue,
          // Prices are frozen at the fixture valuation; before DEMO_DATE the same price is reused.
          valuationTime: asOf < DEMO_DATE ? `${asOf}T15:30:00.000Z` : SAXO_VALUATION_TIME,
          retrievedAt,
        };
        if (h.costBasis !== undefined) {
          holding.costBasis = round2(h.costBasis * ratio);
          holding.unrealizedPnl = round2(marketValue - holding.costBasis);
        }
        return holding;
      })
      .filter((h) => h.quantity > 0);
  }

  async getInvestmentEvents(range: DateRange): Promise<InvestmentEvent[]> {
    const asOf = this.guard();
    return this.store.investmentEvents
      .filter((e) => e.valueDate <= asOf && e.valueDate >= range.from && e.valueDate <= range.to)
      .map((e) => ({ ...e, retrievedAt: retrievalTime(asOf) }));
  }

  /** Saxo reports cash, position value and total value (total already includes cash). */
  override async getBalances(accountId?: string): Promise<Balance[]> {
    const asOf = this.guard();
    const retrievedAt = retrievalTime(asOf);
    const holdings = await this.getHoldings();
    const positions = round2(holdings.reduce((a, h) => a + h.marketValue, 0));
    const out: Balance[] = [];
    for (const a of this.ownAccounts()) {
      if (accountId && a.id !== accountId) continue;
      const cash = this.bookedBalance(a.id, asOf);
      const valuation = asOf < DEMO_DATE ? `${asOf}T15:30:00.000Z` : SAXO_VALUATION_TIME;
      const common = { accountId: a.id, provider: a.provider, sourceAccountId: a.sourceAccountId, currency: a.currency, retrievedAt, origin: this.origin };
      out.push({ ...common, type: "investment_cash", amount: cash, referenceTime: retrievedAt });
      out.push({ ...common, type: "investment_positions", amount: positions, referenceTime: valuation });
      out.push({ ...common, type: "investment_total", amount: round2(cash + positions), referenceTime: valuation });
    }
    return out;
  }
}

/** All three demo connectors sharing one simulated clock and scenario. */
export function createFixtureConnectors(options: FixtureConnectorOptions): Connector[] {
  return [new DanskeBankFixtureConnector(options), new RevolutFixtureConnector(options), new SaxoFixtureConnector(options)];
}

export const FIXTURE_FX_RATES = FX_RATES;
