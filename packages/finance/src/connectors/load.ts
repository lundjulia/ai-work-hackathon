/**
 * Pulls every connector into one `FinanceDataset`. Failures do not abort the
 * load: the failing connection is reported with its state, and data from a
 * previous dataset (if supplied) is kept and marked stale with its original
 * retrieval time.
 */
import type {
  Balance,
  ConnectionStatus,
  Connector,
  FinanceDataset,
  FxRate,
  ISODate,
  Liability,
  MortgageBondQuote,
} from "../types.ts";
import { ConnectorError } from "../types.ts";
import { addDays } from "../util.ts";

export interface LoadDatasetInput {
  connectors: readonly Connector[];
  asOf: ISODate;
  /** First day of history to request. Defaults to the 90 days ending at asOf. */
  from?: ISODate;
  liabilities?: readonly Liability[];
  fxRates?: readonly FxRate[];
  mortgageQuotes?: readonly MortgageBondQuote[];
  /** Last good dataset; used as fallback for connections that fail now. */
  previous?: FinanceDataset;
}

export async function loadDataset(input: LoadDatasetInput): Promise<FinanceDataset> {
  const { connectors, asOf } = input;
  const from = input.from ?? addDays(asOf, -89);
  const range = { from, to: asOf };
  const ds: FinanceDataset = {
    asOf,
    connections: [],
    accounts: [],
    balances: [],
    transactions: [],
    holdings: [],
    investmentEvents: [],
    liabilities: [...(input.liabilities ?? [])],
    fxRates: [...(input.fxRates ?? [])],
    mortgageQuotes: (input.mortgageQuotes ?? []).filter((q) => q.date <= asOf),
  };

  for (const c of connectors) {
    let status: ConnectionStatus;
    try {
      const [accounts, balances, transactions, holdings, events] = await Promise.all([
        c.listAccounts(),
        c.getBalances(),
        c.getTransactions(range),
        c.getHoldings ? c.getHoldings() : Promise.resolve([]),
        c.getInvestmentEvents ? c.getInvestmentEvents(range) : Promise.resolve([]),
      ]);
      status = await c.getStatus();
      ds.accounts.push(...accounts);
      ds.balances.push(...balances);
      ds.transactions.push(...transactions);
      ds.holdings.push(...holdings);
      ds.investmentEvents.push(...events);
    } catch (e) {
      if (!(e instanceof ConnectorError)) throw e;
      status = await c.getStatus();
      const prev = input.previous;
      if (prev) {
        const accountIds = new Set(prev.accounts.filter((a) => a.connectionId === c.connectionId).map((a) => a.id));
        ds.accounts.push(...prev.accounts.filter((a) => accountIds.has(a.id)));
        ds.balances.push(...prev.balances.filter((b) => accountIds.has(b.accountId)).map((b): Balance => ({ ...b, stale: true })));
        ds.transactions.push(...prev.transactions.filter((t) => accountIds.has(t.accountId)));
        ds.holdings.push(...prev.holdings.filter((h) => accountIds.has(h.accountId)));
        ds.investmentEvents.push(...prev.investmentEvents.filter((ev) => accountIds.has(ev.accountId)));
        const lastOk = prev.connections.find((p) => p.connectionId === c.connectionId)?.lastSuccessfulRetrievalAt;
        if (lastOk) status = { ...status, lastSuccessfulRetrievalAt: lastOk };
      }
    }
    ds.connections.push(status);
  }
  return ds;
}
