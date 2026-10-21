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

/** Server-owned demo state. The JSON record is an expedient persistence boundary for this single-persona demo. */
export type DemoState = {
  version: 1;
  simulatedDate: string;
  connectedBanks: BankId[];
  onboarded: boolean;
  goals: Goals;
  adjustments: BalanceAdjustments;
  actions: ActionItem[];
  runs: AutopilotRun[];
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
