import type { DemoResponse } from "../demo-types";
import { buildFinanceView } from "../finance-view";
import type { PersistedDemoState } from "../demo-state-schema";
import { autopilotConfigured, runAutopilotSnapshot } from "./autopilot";

export async function demoResponse(state: PersistedDemoState): Promise<DemoResponse> {
  const { home, accounts, suggestion } = await buildFinanceView(state);
  return { state, home, accounts, suggestion, configured: { autopilot: autopilotConfigured() } };
}

export async function reviewDemoSnapshot(snapshot: PersistedDemoState): Promise<DemoResponse> {
  const result = await runAutopilotSnapshot(snapshot);
  return { ...await demoResponse(result.state), run: result.run, items: result.items };
}
