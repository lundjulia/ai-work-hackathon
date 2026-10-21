"use client";

import { useCallback, useSyncExternalStore } from "react";
import { toast } from "sonner";
import type { DemoResponse, DemoState } from "@/lib/demo-types";
import { getBank, type BankId, type Goals } from "@/lib/view-models";
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
let queue: Promise<unknown> = Promise.resolve();
const listeners = new Set<() => void>();
const emit = () => {
  for (const listener of listeners) listener();
};

async function request(
  payload?: Record<string, unknown>,
): Promise<DemoResponse> {
  const response = await fetch("/api/demo", {
    method: payload ? "POST" : "GET",
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
    cache: "no-store",
  });
  let body: Record<string, unknown>;
  try {
    body = await response.json();
  } catch {
    throw new Error("Autopilot could not load your data. Try again.");
  }
  if (!response.ok)
    throw new Error(
      String(
        body.message ?? body.error ?? "Could not reach Autopilot. Try again.",
      ),
    );
  current = { response: body as DemoResponse, ready: true };
  emit();
  return current.response;
}

export function refreshDemoState() {
  if (loading) return loading;
  loading = request()
    .then(() => {})
    .catch((error: unknown) => {
      current = {
        ...current,
        ready: true,
        error:
          error instanceof Error
            ? error.message
            : "Could not load your accounts.",
      };
      emit();
    })
    .finally(() => {
      loading = undefined;
    });
  return loading;
}

function mutate(payload: Record<string, unknown>) {
  const result = queue.then(() => request(payload));
  queue = result.catch(() => {});
  return result;
}
export const demoActions = {
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
        result.message ?? "Autopilot did not return a completed run.",
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
  void refreshDemoState();
  const refresh = () => {
    void refreshDemoState();
  };
  window.addEventListener("focus", refresh);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("focus", refresh);
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
