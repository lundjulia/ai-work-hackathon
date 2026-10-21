import { DEMO_DATE, FIXTURE_END } from "@claude-impact-lab/finance";

import type { DemoResponse } from "../demo-types";
import { buildFinanceView } from "../finance-view";
import { addDays } from "../view-models";
import { autopilotConfigured, runAutopilot } from "./autopilot";
import { DemoError } from "./demo-errors";
import { createInitialDemoState } from "./demo-initial";
import type { DemoOperation } from "./demo-requests";
import { getDemoStore, type DemoStore, type PersistedDemoState } from "./demo-store";

export async function demoResponse(state: PersistedDemoState): Promise<DemoResponse> {
  const { home, accounts, suggestion } = await buildFinanceView(state);
  return { state, home, accounts, suggestion, configured: { autopilot: autopilotConfigured() } };
}

export async function applyDemoOperation(operation: DemoOperation, store: DemoStore = getDemoStore()): Promise<DemoResponse> {
  if (operation.operation === "runAutopilot") {
    const result = await runAutopilot(store);
    return { ...await demoResponse(result.state), run: result.run, items: result.items };
  }

  const state = await store.mutate(async (current) => {
    switch (operation.operation) {
      case "connectBank":
        if (current.connectedBanks.includes(operation.bankId)) return current;
        return { ...current, connectedBanks: [...current.connectedBanks, operation.bankId], goalsRevision: current.goalsRevision + 1 };
      case "disconnectBank":
        if (!current.connectedBanks.includes(operation.bankId)) return current;
        return { ...current, connectedBanks: current.connectedBanks.filter((id) => id !== operation.bankId), goalsRevision: current.goalsRevision + 1 };
      case "saveGoals":
      case "completeOnboarding": {
        if (operation.operation === "completeOnboarding" && !current.connectedBanks.length) {
          throw new DemoError("banks_required", "Connect a demo bank before finishing onboarding.");
        }
        const changed = JSON.stringify(operation.goals) !== JSON.stringify(current.goals);
        return { ...current, goals: operation.goals, onboarded: current.onboarded || operation.operation === "completeOnboarding", goalsRevision: current.goalsRevision + (changed ? 1 : 0) };
      }
      case "advanceDays": {
        const date = addDays(current.simulatedDate, operation.days);
        if (date < DEMO_DATE || date > FIXTURE_END) {
          throw new DemoError("clock_out_of_range", `The synthetic activity ends on ${FIXTURE_END}. Reset the demo to replay it.`);
        }
        return { ...current, simulatedDate: date };
      }
      case "reset": {
        const initial = await createInitialDemoState();
        return { ...initial, goalsRevision: current.goalsRevision + 1 };
      }
      case "decide": {
        const item = current.actions.find((action) => action.id === operation.id);
        if (!item) throw new DemoError("action_not_found", "This action no longer exists.", 404);
        if (item.status !== "new") throw new DemoError("action_already_decided", "This action has already been decided.", 409);
        const adjustments = { ...current.adjustments };
        if (operation.decision === "approved" && item.type === "transfer") {
          const amount = item.amount?.amount;
          const [fromId, toId] = item.accounts ?? [];
          if (!amount || !Number.isFinite(amount) || amount <= 0 || item.amount?.currency !== "DKK" || !fromId || !toId || fromId === toId) {
            throw new DemoError("invalid_transfer", "This transfer proposal is invalid.", 409);
          }
          if (item.goalRevision !== current.goalsRevision || !item.candidateKey) {
            throw new DemoError("stale_transfer", "Your goals or connections changed. Dismiss this proposal and run Autopilot again.", 409);
          }
          const view = await buildFinanceView(current);
          const from = view.accounts.find((account) => account.id === fromId);
          const to = view.accounts.find((account) => account.id === toId);
          const candidate = view.candidates.find((candidate) => candidate.key === item.candidateKey);
          const balances = view.dataset.balances.filter((balance) => balance.accountId === fromId && ["booked", "available"].includes(balance.type));
          const available = Math.min(...balances.map((balance) => balance.amount));
          const connected = [fromId, toId].every((accountId) => {
            const account = view.dataset.accounts.find((account) => account.id === accountId);
            return account && view.dataset.connections.some((connection) => connection.connectionId === account.connectionId && connection.state === "connected");
          });
          if (!from || !to || from.kind !== "current" || to.kind !== "savings" || from.currency !== "DKK" || to.currency !== "DKK" || !connected || balances.some((balance) => balance.stale)) {
            throw new DemoError("transfer_accounts_unavailable", "Reconnect the transfer accounts before approving this proposal.", 409);
          }
          if (!candidate || candidate.type !== "transfer_suggestion" || candidate.amount !== amount || candidate.accounts?.[0] !== fromId || candidate.accounts?.[1] !== toId || !Number.isFinite(available) || available - amount < view.domainGoals.minimumBalance) {
            throw new DemoError("stale_transfer", "This transfer no longer fits the latest balances and safety limit. Dismiss it and run Autopilot again.", 409);
          }
          adjustments[fromId] = (adjustments[fromId] ?? 0) - amount;
          adjustments[toId] = (adjustments[toId] ?? 0) + amount;
        }
        return { ...current, adjustments, actions: current.actions.map((action) => action.id === item.id ? { ...action, status: operation.decision } : action) };
      }
      case "reopen": {
        const item = current.actions.find((action) => action.id === operation.id);
        if (!item) throw new DemoError("action_not_found", "This action no longer exists.", 404);
        if (item.status !== "dismissed") throw new DemoError("action_not_dismissed", "Only dismissed actions can be reopened.", 409);
        return { ...current, actions: current.actions.map((action) => action.id === item.id ? { ...action, status: "new" } : action) };
      }
      case "markNotUseful": {
        if (!current.actions.some((action) => action.id === operation.id)) throw new DemoError("action_not_found", "This action no longer exists.", 404);
        return { ...current, actions: current.actions.map((action) => action.id === operation.id ? { ...action, feedback: "not_useful" } : action) };
      }
    }
  });

  if (operation.operation === "completeOnboarding") {
    if (!autopilotConfigured()) return { ...await demoResponse(state), message: "Your goals are saved. Autopilot needs a Claude API key before its first review." };
    try {
      const result = await runAutopilot(store);
      return { ...await demoResponse(result.state), run: result.run, items: result.items };
    } catch (error) {
      if (!(error instanceof DemoError)) throw error;
      return { ...await demoResponse((await store.read()).state), message: `Your goals are saved. ${error.message}` };
    }
  }
  return demoResponse(state);
}
