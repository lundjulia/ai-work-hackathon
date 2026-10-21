import { DEMO_DATE, FIXTURE_END } from "@claude-impact-lab/finance";

import { buildFinanceView } from "./finance-view";
import { addDays } from "./view-models";
import { DemoError } from "./demo-errors";
import { createInitialDemoState } from "./demo-initial";
import { demoOperationSchema, type DemoOperation } from "./demo-operation-schema";
import { CATEGORY_LABELS, type DemoNotification } from "./demo-notifications";
import { persistedDemoStateSchema, type PersistedDemoState } from "./demo-state-schema";

/** Deterministic browser transition. The browser store owns its atomic revision commit. */
export async function applyLocalDemoOperation(snapshot: PersistedDemoState, input: DemoOperation): Promise<PersistedDemoState> {
  const parsed = persistedDemoStateSchema.safeParse(snapshot);
  const request = demoOperationSchema.safeParse(input);
  if (!parsed.success || !request.success) throw new DemoError("invalid_request", "The saved demo state or operation is invalid.");
  const current = parsed.data;
  const operation = request.data;
  if (operation.operation === "runAutopilot") throw new DemoError("server_review_required", "Run Penny through the Claude review endpoint.");
  const transition = async (): Promise<PersistedDemoState> => {
    switch (operation.operation) {
      case "connectNexi":
        return { ...current, nexiConnected: true };
      case "readNotification":
        return { ...current, notifications: (current.notifications ?? []).map((item) => item.id === operation.id ? { ...item, read: true } : item) };
      case "triggerEvent": {
        if (operation.kind === "receipt" && !current.nexiConnected) throw new DemoError("nexi_required", "Connect the Nexi demo before showing a receipt notification.");
        const view = await buildFinanceView(current);
        const budget = view.home.spending.categories.find((item) => item.category === "groceries") ?? view.home.spending.categories[0];
        const action = current.actions.find((item) => item.status === "new");
        const descriptions: Record<typeof operation.kind, Pick<DemoNotification, "title" | "body">> = {
          receipt: { title: "A receipt arrived from Nexi", body: "A sample shopping receipt is ready to discuss. This is a simulated notification; your spending has not changed." },
          budget: { title: "A quick budget check", body: budget ? `Let's look at ${CATEGORY_LABELS[budget.category].toLowerCase()} together and see what's left this month.` : "Let's choose a spending budget that works for your family." },
          review: { title: "Your money check is ready", body: action?.title ?? "Penny can look through your accounts with you. This sample notification has not run a new review." },
          goal: { title: "Let's check your savings goal", body: `Want to see how things stand for ${current.goals.savingsGoal.name}?` },
        };
        const notification: DemoNotification = {
          id: crypto.randomUUID(), kind: operation.kind, ...descriptions[operation.kind], createdAt: new Date().toISOString(), read: false,
          ...(operation.kind === "budget" && budget ? { category: budget.category } : {}),
          ...(operation.kind === "review" && action ? { actionId: action.id } : {}),
        };
        return { ...current, notifications: [notification, ...(current.notifications ?? [])].slice(0, 100) };
      }
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
            throw new DemoError("stale_transfer", "Your goals or connections changed. Dismiss this proposal and run Penny again.", 409);
          }
          const run = current.runs.find((run) => run.id === item.runId);
          if (!run || run.engine !== "claude" || run.goalRevision !== item.goalRevision || run.ranAt !== item.createdAt) {
            throw new DemoError("invalid_transfer", "This proposal has no matching review record.", 409);
          }
          const reviewedView = await buildFinanceView({ ...current, simulatedDate: run.date });
          const reviewed = reviewedView.candidates.find((candidate) => candidate.key === item.candidateKey);
          if (!reviewed || reviewed.title !== item.title || reviewed.body !== item.body || reviewed.rationale !== item.rationale || reviewed.amount !== amount || reviewed.triggeredOn !== item.triggeredOn || !item.facts || Object.entries(reviewed.facts).some(([key, value]) => item.facts?.[key] !== value)) {
            throw new DemoError("invalid_transfer", "This proposal differs from its computed review evidence.", 409);
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
            throw new DemoError("stale_transfer", "This transfer no longer fits the latest balances and safety limit. Dismiss it and run Penny again.", 409);
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
  };
  const next = await transition();
  const checked = persistedDemoStateSchema.safeParse(next);
  if (!checked.success) throw new DemoError("invalid_state", "The demo state exceeded its storage bounds. Reset the demo to continue.", 409);
  return checked.data;
}
