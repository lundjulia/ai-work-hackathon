"use client";

import { Button } from "@claude-impact-lab/ui/components/button";
import { Skeleton } from "@claude-impact-lab/ui/components/skeleton";
import { useState } from "react";
import { toast } from "sonner";

import {
  demoActions,
  useAccounts,
  useDemoState,
  useHydrated,
  useHome,
  useSuggestion,
  reportDemoError,
} from "@/components/app-state";
import {
  BudgetsField,
  IncomeField,
  RiskField,
  SafetyNetField,
  SavingsGoalField,
} from "@/components/goals-fields";
import { Panel } from "@/components/section";
import { type Goals } from "@/lib/view-models";

function GoalsEditor({ initial }: { initial: Goals }) {
  const accounts = useAccounts();
  const suggestion = useSuggestion();
  const home = useHome();
  const [saving, setSaving] = useState(false);
  const [goals, setGoals] = useState<Goals>(initial);
  const dirty = JSON.stringify(goals) !== JSON.stringify(initial);
  const fieldProps = { goals, suggestion, onChange: setGoals };
  const buffer = accounts.find((a) => a.kind === "savings")?.balanceDkk;

  return (
    <>
      <div className="space-y-4">
        <Panel>
          <SafetyNetField
            {...fieldProps}
            monthlyEssentials={home.safetyNet.monthlyEssentials}
            currentBuffer={buffer}
          />
        </Panel>
        <Panel>
          <SavingsGoalField {...fieldProps} />
        </Panel>
        <BudgetsField {...fieldProps} />
        <Panel>
          <IncomeField {...fieldProps} />
        </Panel>
        <Panel>
          <RiskField {...fieldProps} />
        </Panel>
      </div>
      <div
        className={
          dirty
            ? "sticky bottom-3 z-10 animate-in duration-300 fade-in slide-in-from-bottom-4"
            : "hidden"
        }
      >
        <div className="flex gap-2 rounded-full bg-card/95 p-1.5 shadow-xl ring-1 ring-foreground/10 backdrop-blur">
          <Button
            variant="ghost"
            className="h-11 flex-1"
            onClick={() => setGoals(initial)}
          >
            Discard
          </Button>
          <Button
            className="h-11 flex-[2]"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await demoActions.saveGoals(goals);
                toast.success("Goals saved", {
                  description: "The next autopilot run uses them.",
                });
              } catch (error) {
                reportDemoError(error);
              } finally {
                setSaving(false);
              }
            }}
          >
            Save changes
          </Button>
        </div>
      </div>
    </>
  );
}

export function GoalsScreen() {
  const hydrated = useHydrated();
  const { goals } = useDemoState();

  return (
    <main className="space-y-6 px-5 pt-6 pb-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Goals</h1>
        <p className="text-sm text-muted-foreground">
          Penny checks every run against these. Change them any time.
        </p>
      </header>
      {hydrated ? (
        <GoalsEditor key={JSON.stringify(goals)} initial={goals} />
      ) : (
        <div className="space-y-4">
          <Skeleton className="h-48 rounded-3xl" />
          <Skeleton className="h-48 rounded-3xl" />
        </div>
      )}
    </main>
  );
}
