import type {
  ActionItem,
  AutopilotRun,
  BalanceAdjustments,
  BankId,
  GoalSuggestion,
  Goals,
  HomeVM,
  Account,
} from "./view-models";
import type { DemoNotification } from "./demo-notifications";

/** Browser-owned shared state for the single-persona demo. */
export type DemoState = {
  version: 1;
  simulatedDate: string;
  connectedBanks: BankId[];
  onboarded: boolean;
  goals: Goals;
  adjustments: BalanceAdjustments;
  actions: ActionItem[];
  runs: AutopilotRun[];
  nexiConnected?: boolean;
  notifications?: DemoNotification[];
};

export type DemoResponse = {
  state: DemoState;
  home: HomeVM;
  accounts: Account[];
  suggestion: GoalSuggestion;
  configured: { autopilot: boolean };
  run?: AutopilotRun;
  items?: ActionItem[];
  message?: string;
};
