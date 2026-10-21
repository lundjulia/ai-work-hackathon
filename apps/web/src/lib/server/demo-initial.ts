import { DEFAULT_GOALS, DEMO_DATE } from "@claude-impact-lab/finance";

import { toUiGoals } from "../finance-view";
import type { PersistedDemoState } from "./demo-store";

export async function createInitialDemoState(): Promise<PersistedDemoState> {
  return {
    version: 1,
    simulatedDate: DEMO_DATE,
    connectedBanks: [],
    onboarded: false,
    goals: toUiGoals(DEFAULT_GOALS),
    adjustments: {},
    actions: [],
    runs: [],
    goalsRevision: 0,
  };
}
