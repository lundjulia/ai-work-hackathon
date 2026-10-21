import type { FinanceDataset, ISODate } from "../types.ts";
import { createFixtureConnectors, FIXTURE_SCENARIOS } from "../connectors/fixture.ts";
import type { FixtureScenario } from "../connectors/fixture.ts";
import { loadDataset } from "../connectors/load.ts";
import { CONSUMER_LOAN, DEMO_DATE, FX_RATES, FIXTURE_END, HISTORY_START, MORTGAGE, MORTGAGE_QUOTES } from "./persona.ts";

export * from "./persona.ts";
export { generateFixtureStore, getFixtureStore } from "./generate.ts";
export type { FixtureStore, FixtureTransaction, FixtureHolding, FixtureInvestmentEvent } from "./generate.ts";

/**
 * Loads the synthetic persona's dataset as the app would see it on `asOf`:
 * all three fixture connectors, history since HISTORY_START, the user-entered
 * liabilities, fixture FX rates and mortgage quotes.
 *
 * In scenarios with an expired consent, the data from the last valid day is
 * loaded first and kept as stale fallback, as app storage would.
 */
export async function loadDemoDataset(
  asOf: ISODate = DEMO_DATE,
  scenario: FixtureScenario = FIXTURE_SCENARIOS.healthy,
): Promise<FinanceDataset> {
  if (asOf > FIXTURE_END) throw new RangeError(`Synthetic activity ends on ${FIXTURE_END}; choose an earlier simulated day.`);
  const base = {
    from: HISTORY_START,
    liabilities: [MORTGAGE, CONSUMER_LOAN],
    fxRates: FX_RATES,
    mortgageQuotes: MORTGAGE_QUOTES,
  };
  let previous: FinanceDataset | undefined;
  const lastValid = Object.values(scenario.consentValidUntil ?? {}).filter((d): d is ISODate => !!d && d < asOf).sort()[0];
  if (lastValid) {
    previous = await loadDataset({ ...base, asOf: lastValid, connectors: createFixtureConnectors({ clock: () => lastValid, scenario }) });
  }
  const connectors = createFixtureConnectors({ clock: () => asOf, scenario });
  return loadDataset({ ...base, asOf, connectors, ...(previous ? { previous } : {}) });
}
