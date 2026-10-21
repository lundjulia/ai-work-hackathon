"use client";

import { Button } from "@claude-impact-lab/ui/components/button";
import { cn } from "@claude-impact-lab/ui/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  BellRing,
  Check,
  Loader2,
  Moon,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  demoActions,
  useAccounts,
  useDemoState,
  useHome,
  useSuggestion,
  useHydrated,
  reportDemoError,
} from "@/components/app-state";
import { LogoMark } from "@/components/brand";
import {
  BudgetsField,
  IncomeField,
  RiskField,
  SafetyNetField,
  SavingsGoalField,
} from "@/components/goals-fields";
import { formatMoney } from "@/lib/format";
import { type AutopilotRun, type Goals } from "@/lib/view-models";

import { ConnectBanks } from "./connect-banks";

const STEPS = [
  "welcome",
  "banks",
  "income",
  "safety",
  "budgets",
  "done",
] as const;
type Step = (typeof STEPS)[number];

function StepHeader({
  eyebrow,
  title,
  body,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
}) {
  return (
    <div className="space-y-2">
      {eyebrow ? (
        <p className="text-sm font-medium text-primary">{eyebrow}</p>
      ) : null}
      <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight">
        {title}
      </h1>
      {body ? (
        <p className="text-[15px] text-muted-foreground">{body}</p>
      ) : null}
    </div>
  );
}

function Welcome() {
  return (
    <div className="flex flex-1 flex-col justify-center gap-10">
      <LogoMark className="size-14 animate-in duration-700 zoom-in-90 fade-in" />
      <div className="animate-in space-y-4 delay-100 duration-700 fill-mode-both fade-in slide-in-from-bottom-3">
        <h1 className="text-[2.1rem] leading-[1.1] font-semibold tracking-tight">
          You don&apos;t need to open this app.
        </h1>
        <p className="text-lg text-muted-foreground">
          Go live your life. We&apos;ll tell you when something needs you.
        </p>
      </div>
      <ul className="animate-in space-y-4 delay-300 duration-700 fill-mode-both fade-in">
        {[
          {
            icon: Moon,
            text: "Every morning, Autopilot reviews all your accounts.",
          },
          {
            icon: BellRing,
            text: "It only pings you when there is something to act on.",
          },
          {
            icon: ShieldCheck,
            text: "Read-only. Nothing moves without your approval.",
          },
        ].map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-start gap-3 text-[15px]">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Icon className="size-4" />
            </span>
            <span className="pt-1">{text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Done({
  run,
  finished,
  error,
  message,
}: {
  run: AutopilotRun | null;
  finished: boolean;
  error: string | null;
  message: string | null;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
      <div className="relative">
        <span className="absolute inset-0 animate-ping rounded-full bg-primary/20 [animation-iteration-count:2]" />
        <span className="relative flex size-20 animate-in items-center justify-center rounded-full bg-primary text-primary-foreground duration-500 zoom-in-50">
          {finished ? (
            <Check className="size-9" strokeWidth={2.5} />
          ) : error ? (
            <ShieldCheck className="size-8" />
          ) : (
            <Loader2 className="size-8 animate-spin" />
          )}
        </span>
      </div>
      <div className="space-y-3">
        <h1 className="text-[2rem] leading-tight font-semibold tracking-tight">
          {run
            ? "You’re on autopilot."
            : finished
              ? "Your goals are saved."
              : error
                ? "We couldn’t finish setup."
                : "Setting up your autopilot."}
        </h1>
        <p
          className="mx-auto max-w-xs text-[15px] text-muted-foreground"
          aria-live="polite"
        >
          {run
            ? `First check done. ${run.summary}`
            : (error ??
              message ??
              (finished
                ? "Autopilot needs its AI connection before the first check. You can explore your connected accounts now."
                : "Saving your goals and checking your accounts…"))}
        </p>
      </div>
      <p className="max-w-xs text-sm text-muted-foreground">
        Use the demo controls to advance the date and run a check.
      </p>
    </div>
  );
}

export function OnboardingFlow() {
  const router = useRouter();
  const state = useDemoState();
  const accounts = useAccounts();
  const suggestion = useSuggestion();
  const home = useHome();
  const ready = useHydrated();
  const [finished, setFinished] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const suggested = useRef(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [goals, setGoals] = useState<Goals>(state.goals);
  const [firstRun, setFirstRun] = useState<AutopilotRun | null>(null);
  const started = useRef(false);
  const step: Step = STEPS[stepIndex] ?? "welcome";

  useEffect(() => {
    if (step !== "done" || started.current) return;
    started.current = true;
    demoActions
      .completeOnboarding(goals)
      .then(({ run, message }) => {
        setFirstRun(run ?? null);
        setMessage(message ?? null);
        setFinished(true);
      })
      .catch((error: unknown) => {
        started.current = false;
        setError(
          error instanceof Error ? error.message : "Could not save your goals.",
        );
        reportDemoError(error);
      });
  }, [step, goals]);

  const next = () => {
    if (step === "banks" && !suggested.current) {
      setGoals(suggestion.goals);
      suggested.current = true;
    }
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  };
  const back = () => setStepIndex((i) => Math.max(i - 1, 0));
  const fieldProps = { goals, suggestion, onChange: setGoals };
  const connectedCount = state.connectedBanks.length;
  const total = accounts.reduce((s, a) => s + a.balanceDkk, 0);
  const buffer = accounts.find((a) => a.kind === "savings")?.balanceDkk;

  const primary: { label: string; onClick: () => void; disabled?: boolean } =
    step === "welcome"
      ? { label: "Get started", onClick: next }
      : step === "banks"
        ? {
            label:
              connectedCount === 0 ? "Connect a bank to continue" : "Continue",
            onClick: next,
            disabled: connectedCount === 0,
          }
        : step === "budgets"
          ? { label: "Turn on autopilot", onClick: next }
          : step === "done"
            ? {
                label: "Go to Home",
                onClick: () => router.push("/"),
                disabled: !finished,
              }
            : { label: "Continue", onClick: next };

  const progressSteps = STEPS.length - 2; // welcome and done are not counted
  const progress = Math.min(Math.max(stepIndex, 0), progressSteps);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 px-4">
        {step !== "welcome" && step !== "done" ? (
          <button
            type="button"
            onClick={back}
            aria-label="Back"
            className="flex size-9 items-center justify-center rounded-full transition hover:bg-muted"
          >
            <ArrowLeft className="size-5" />
          </button>
        ) : (
          <span className="size-9" />
        )}
        {step !== "welcome" && step !== "done" ? (
          <div
            className="flex flex-1 gap-1.5"
            aria-label={`Step ${progress} of ${progressSteps}`}
          >
            {Array.from({ length: progressSteps }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1 flex-1 rounded-full bg-foreground/10 transition-colors duration-500",
                  i < progress && "bg-primary",
                )}
              />
            ))}
          </div>
        ) : null}
        <span className="size-9" />
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-6">
        <div
          key={step}
          className="flex flex-1 animate-in flex-col duration-500 fade-in slide-in-from-right-4"
        >
          {step === "welcome" ? <Welcome /> : null}

          {step === "banks" ? (
            <div className="space-y-6 pt-2">
              <StepHeader
                eyebrow="Step 1 of 4"
                title="Connect your banks"
                body="Read-only access through Open Banking. Connect all three to get the full picture."
              />
              <ConnectBanks />
              {connectedCount > 0 ? (
                <div className="flex items-baseline justify-between rounded-3xl bg-foreground px-5 py-4 text-background">
                  <span className="text-sm opacity-70">Total found</span>
                  <span className="figure text-xl font-semibold">
                    {formatMoney(total)}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === "income" ? (
            <div className="space-y-8 pt-2">
              <StepHeader
                eyebrow="Step 2 of 4"
                title="Income and risk"
                body="Autopilot read 90 days of history and filled this in. Adjust anything that looks off."
              />
              <IncomeField {...fieldProps} />
              <RiskField {...fieldProps} />
            </div>
          ) : null}

          {step === "safety" ? (
            <div className="space-y-8 pt-2">
              <StepHeader
                eyebrow="Step 3 of 4"
                title="Safety net and savings"
                body="How much cushion you want, and what you are saving for."
              />
              <SafetyNetField
                {...fieldProps}
                monthlyEssentials={home.safetyNet.monthlyEssentials}
                currentBuffer={buffer}
              />
              <SavingsGoalField {...fieldProps} />
            </div>
          ) : null}

          {step === "budgets" ? (
            <div className="space-y-6 pt-2">
              <StepHeader
                eyebrow="Step 4 of 4"
                title="Your budgets"
                body="Autopilot will warn you early, before a budget runs out."
              />
              <BudgetsField {...fieldProps} />
            </div>
          ) : null}

          {step === "done" ? (
            <>
              <Done
                run={firstRun}
                finished={finished}
                error={error}
                message={message}
              />
              {error ? (
                <Button
                  onClick={() => {
                    setError(null);
                    started.current = false;
                    setStepIndex(STEPS.length - 2);
                  }}
                >
                  Back to goals and retry
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      <footer className="shrink-0 px-6 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <Button
          size="lg"
          className="h-13 w-full text-base"
          onClick={primary.onClick}
          disabled={primary.disabled || !ready}
        >
          {primary.label}
          {!primary.disabled ? <ArrowRight data-icon="inline-end" /> : null}
        </Button>
      </footer>
    </div>
  );
}
