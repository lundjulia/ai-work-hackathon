"use client";

import { useCallback, useSyncExternalStore } from "react";
import { toast } from "sonner";
import type { DemoResponse, DemoState } from "@/lib/demo-types";
import { getBank, type BankId, type Goals } from "@/lib/view-models";
import { subscribeToStateChanges } from "@/lib/state-realtime";
import { buildFinanceView } from "@/lib/finance-view";
import { getLocalDemoStore, type LocalDemoRecord } from "@/lib/local-demo-store";
import { applyLocalDemoOperation } from "@/lib/demo-operations";
import { DemoError } from "@/lib/demo-errors";
import type { DemoOperation } from "@/lib/demo-operation-schema";
import { reviewNotifications, type DemoEventKind } from "@/lib/demo-notifications";
export type { DemoState } from "@/lib/demo-types";

const EMPTY_STATE: DemoState = {
  version: 1,
  simulatedDate: "2026-10-19",
  connectedBanks: [],
  onboarded: false,
  goals: {
    monthlyIncome: 0,
    riskTolerance: "balanced",
    safetyNetMonths: 3,
    savingsGoal: { name: "Savings", target: 0, date: "2027-06-01" },
    budgets: {
      groceries: 0,
      restaurants: 0,
      transport: 0,
      shopping: 0,
      subscriptions: 0,
      entertainment: 0,
    },
  },
  adjustments: {},
  actions: [],
  runs: [],
};
const EMPTY: DemoResponse = {
  state: EMPTY_STATE,
  accounts: [],
  configured: { autopilot: false },
  suggestion: {
    goals: EMPTY_STATE.goals,
    reasons: {
      monthlyIncome: "Connect a bank to estimate your income.",
      riskTolerance: "Choose the risk you are comfortable with.",
      safetyNetMonths: "Choose your safety target.",
      savingsGoal: "Choose your savings goal.",
      budgets: {},
    },
  },
  home: {
    date: EMPTY_STATE.simulatedDate,
    firstName: "Sofie",
    total: { totalDkk: 0, cashDkk: 0, investmentsDkk: 0 },
    banks: [],
    spending: {
      monthLabel: "October",
      daysLeftInMonth: 12,
      spent: 0,
      budget: 0,
      categories: [],
    },
    forecast: {
      payday: EMPTY_STATE.simulatedDate,
      daysToPayday: 0,
      balanceToday: 0,
      projectedAtPayday: 0,
      bills: [],
    },
    safetyNet: {
      months: 0,
      targetMonths: 3,
      bufferDkk: 0,
      monthlyEssentials: 0,
    },
    savingsGoal: { ...EMPTY_STATE.goals.savingsGoal, saved: 0 },
    newActionCount: 0,
    recent: [],
  },
};
type Store = { response: DemoResponse; ready: boolean; error?: string };
const INITIAL: Store = { response: EMPTY, ready: false };
let current: Store = INITIAL;
let loading: Promise<void> | undefined;
let refreshPending = false;
let stopRealtime: (() => void) | undefined;
let queue: Promise<unknown> = Promise.resolve();
const listeners = new Set<() => void>();
const emit = () => {
  for (const listener of listeners) listener();
};

let configured: boolean | undefined;
let configuring: Promise<boolean> | undefined;
async function configuration() {
  if (configured !== undefined) return configured;
  configuring ??= fetch("/api/demo", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) throw new Error("Could not check Penny configuration.");
      const body = await response.json() as { configured?: { autopilot?: boolean } };
      configured = body.configured?.autopilot === true;
      return configured;
    })
    .finally(() => { configuring = undefined; });
  return configuring;
}

async function showRecord(record: LocalDemoRecord, extra: Partial<DemoResponse> = {}): Promise<DemoResponse> {
  const view = await buildFinanceView(record.state);
  // An async view can finish after another tab saved newer state.
  const latest = await getLocalDemoStore().read();
  if (latest.revision !== record.revision) return showRecord(latest);
  const response: DemoResponse = {
    state: record.state, home: view.home, accounts: view.accounts, suggestion: view.suggestion,
    configured: { autopilot: configured === true }, ...extra,
  };
  current = { response, ready: true };
  emit();
  return response;
}

export function refreshDemoState() {
  if (loading) { refreshPending = true; return loading; }
  loading = Promise.resolve().then(() => getLocalDemoStore().read())
    .then((record) => showRecord(record))
    .then(() => {})
    .catch((error: unknown) => {
      current = { ...current, ready: true, error: error instanceof Error ? error.message : "Could not load your accounts." };
      emit();
    })
    .finally(() => {
      loading = undefined;
      if (refreshPending) { refreshPending = false; void refreshDemoState(); }
    });
  return loading;
}

async function review(): Promise<DemoResponse> {
  const store = getLocalDemoStore();
  const before = await store.read();
  // This request holds no browser lock. Another tab can keep editing during the review.
  const response = await fetch("/api/demo", {
    method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
    body: JSON.stringify({ snapshot: before.state, operation: "runAutopilot" }),
  });
  const body = await response.json().catch(() => null) as DemoResponse & { error?: string } | null;
  if (!response.ok || !body?.run) throw new Error(body?.message ?? body?.error ?? "Penny did not return a completed run.");
  const reviewed = { ...body.state, notifications: [...reviewNotifications(body.items ?? []), ...(before.state.notifications ?? [])].slice(0, 100) } as LocalDemoRecord["state"];
  if (!await store.compareAndSwap(before.revision, reviewed)) {
    await showRecord(await store.read());
    throw new DemoError("state_conflict", "Your data changed during the review. Run Penny again for the latest state.", 409);
  }
  return showRecord(await store.read(), { run: body.run, items: body.items ?? [] });
}

function mutate(payload: DemoOperation): Promise<DemoResponse> {
  const result = queue.then(async () => {
    if (payload.operation === "runAutopilot") return review();
    const record = await getLocalDemoStore().mutate((state) => applyLocalDemoOperation(state, payload));
    const saved = await showRecord(record);
    if (payload.operation !== "completeOnboarding") return saved;
    try {
      if (!await configuration()) return { ...saved, message: "Your goals are saved. Penny needs a Claude API key before its first review." };
      return await review();
    } catch (error) {
      const latest = await showRecord(await getLocalDemoStore().read());
      return { ...latest, message: `Your goals are saved. ${error instanceof Error ? error.message : "The first review could not complete. Try again."}` };
    }
  });
  queue = result.catch(() => {});
  return result;
}
export const demoActions = {
  connectNexi() { return mutate({ operation: "connectNexi" }); },
  async triggerEvent(kind: DemoEventKind) {
    const result = await mutate({ operation: "triggerEvent", kind });
    return result.state.notifications![0]!;
  },
  readNotification(id: string) { return mutate({ operation: "readNotification", id }); },
  async connectBank(bankId: BankId) {
    const result = await mutate({ operation: "connectBank", bankId });
    return result.accounts.filter((account) => account.bankId === bankId);
  },
  disconnectBank(bankId: BankId) {
    return mutate({ operation: "disconnectBank", bankId });
  },
  saveGoals(goals: Goals) {
    return mutate({ operation: "saveGoals", goals });
  },
  completeOnboarding(goals: Goals) {
    return mutate({ operation: "completeOnboarding", goals });
  },
  advanceDays(days: number) {
    return mutate({ operation: "advanceDays", days });
  },
  async runAutopilot() {
    const result = await mutate({ operation: "runAutopilot" });
    if (!result.run)
      throw new Error(
        result.message ?? "Penny did not return a completed run.",
      );
    return { run: result.run, items: result.items ?? [] };
  },
  decide(id: string, decision: "approved" | "dismissed") {
    return mutate({ operation: "decide", id, decision });
  },
  reopen(id: string) {
    return mutate({ operation: "reopen", id });
  },
  markNotUseful(id: string) {
    return mutate({ operation: "markNotUseful", id });
  },
  reset() {
    return mutate({ operation: "reset" });
  },
};
export function reportDemoError(error: unknown) {
  toast.error(
    error instanceof Error ? error.message : "Something went wrong. Try again.",
  );
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    stopRealtime = subscribeToStateChanges(() => { void refreshDemoState(); });
    void configuration().then(() => refreshDemoState()).catch(() => {});
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) { stopRealtime?.(); stopRealtime = undefined; }
  };
}
const getSnapshot = () => current;
const getServerSnapshot = () => INITIAL;
function useStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
export function useDemoState() {
  return useStore().response.state;
}
export function useHydrated() {
  return useStore().ready;
}
export function useHome() {
  return useStore().response.home;
}
export function useAccounts() {
  return useStore().response.accounts;
}
export function useSuggestion() {
  return useStore().response.suggestion;
}
export function useAutopilotConfigured() {
  return useStore().response.configured.autopilot;
}
export function useDemoError() {
  return useStore().error;
}
export function useNewActionCount() {
  return useDemoState().actions.filter((action) => action.status === "new")
    .length;
}
export function useAccountLabel() {
  const accounts = useAccounts();
  return useCallback(
    (id?: string) => {
      const account = accounts.find((candidate) => candidate.id === id);
      return account
        ? `${getBank(account.bankId).shortName} ${account.name}`
        : "Unknown account";
    },
    [accounts],
  );
}
