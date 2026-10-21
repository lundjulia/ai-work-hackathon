"use client";

import { Input } from "@claude-impact-lab/ui/components/input";
import { Slider } from "@claude-impact-lab/ui/components/slider";
import { cn } from "@claude-impact-lab/ui/lib/utils";
import { Minus, Plus, Sparkles } from "lucide-react";
import { useId } from "react";

import { formatMoney, formatNumber } from "@/lib/format";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type CategoryId,
  type Goals,
  type GoalSuggestion,
  type RiskTolerance,
} from "@/lib/view-models";

/** "Penny suggests…" hint. Offers a one-tap reset when the user has changed the value. */
export function Suggestion({
  children,
  changed,
  onUse,
  className,
}: {
  children: React.ReactNode;
  changed?: boolean;
  onUse?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-2xl bg-accent/70 px-3 py-2.5 text-[13px] leading-snug text-accent-foreground",
        className,
      )}
    >
      <Sparkles className="mt-0.5 size-3.5 shrink-0" />
      <div className="flex-1">{children}</div>
      {changed && onUse ? (
        <button
          type="button"
          onClick={onUse}
          className="shrink-0 text-[13px] font-medium underline underline-offset-2"
        >
          Use
        </button>
      ) : null}
    </div>
  );
}

function parseAmount(text: string): number {
  const digits = text.replace(/[^\d]/g, "");
  return digits ? Number.parseInt(digits, 10) : 0;
}

export function AmountInput({
  value,
  onChange,
  id,
  className,
  "aria-label": ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  id?: string;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-sm text-muted-foreground">
        DKK
      </span>
      <Input
        id={id}
        aria-label={ariaLabel}
        inputMode="numeric"
        value={value ? formatNumber(value) : ""}
        onChange={(e) => onChange(parseAmount(e.target.value))}
        className="figure h-12 rounded-2xl bg-card pl-14 text-lg font-medium"
      />
    </div>
  );
}

export function Stepper({
  value,
  onChange,
  step = 100,
  min = 0,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        onClick={() => onChange(Math.max(min, value - step))}
        className="flex size-8 items-center justify-center rounded-full bg-muted text-foreground transition active:scale-95"
      >
        <Minus className="size-3.5" />
      </button>
      <span className="figure w-[5.5rem] text-center text-sm font-medium">
        {formatMoney(value)}
      </span>
      <button
        type="button"
        aria-label={`Increase ${label}`}
        onClick={() => onChange(value + step)}
        className="flex size-8 items-center justify-center rounded-full bg-muted text-foreground transition active:scale-95"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

type FieldProps = {
  goals: Goals;
  suggestion: GoalSuggestion;
  onChange: (goals: Goals) => void;
};

export function IncomeField({ goals, suggestion, onChange }: FieldProps) {
  const id = useId();
  const suggested = suggestion.goals.monthlyIncome;
  return (
    <div className="space-y-3">
      <label htmlFor={id} className="text-sm font-medium">
        Monthly income after tax
      </label>
      <AmountInput
        id={id}
        value={goals.monthlyIncome}
        onChange={(monthlyIncome) => onChange({ ...goals, monthlyIncome })}
      />
      <Suggestion
        changed={goals.monthlyIncome !== suggested}
        onUse={() => onChange({ ...goals, monthlyIncome: suggested })}
      >
        Penny suggests {formatMoney(suggested)}. {suggestion.reasons.monthlyIncome}
      </Suggestion>
    </div>
  );
}

const RISK_OPTIONS: { id: RiskTolerance; label: string; detail: string }[] = [
  { id: "conservative", label: "Conservative", detail: "Protect what I have. Small ups and downs." },
  { id: "balanced", label: "Balanced", detail: "Steady growth. I can sit through a dip." },
  { id: "growth", label: "Growth", detail: "Long horizon. Big swings are fine." },
];

export function RiskField({ goals, suggestion, onChange }: FieldProps) {
  const suggested = suggestion.goals.riskTolerance;
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Risk tolerance</p>
      <div role="radiogroup" aria-label="Risk tolerance" className="space-y-2">
        {RISK_OPTIONS.map((option) => {
          const selected = goals.riskTolerance === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange({ ...goals, riskTolerance: option.id })}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl bg-card px-4 py-3.5 text-left ring-1 ring-foreground/10 transition",
                selected && "ring-2 ring-primary",
              )}
            >
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-foreground/20 transition",
                  selected && "border-primary",
                )}
              >
                {selected ? <span className="size-2.5 rounded-full bg-primary" /> : null}
              </span>
              <span className="flex-1">
                <span className="flex items-center gap-2 text-sm font-medium">
                  {option.label}
                  {option.id === suggested ? (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
                      Suggested
                    </span>
                  ) : null}
                </span>
                <span className="block text-[13px] text-muted-foreground">{option.detail}</span>
              </span>
            </button>
          );
        })}
      </div>
      <Suggestion>{suggestion.reasons.riskTolerance}</Suggestion>
    </div>
  );
}

export function SafetyNetField({
  goals,
  suggestion,
  onChange,
  monthlyEssentials,
  currentBuffer,
}: FieldProps & { monthlyEssentials: number; currentBuffer?: number }) {
  const months = goals.safetyNetMonths;
  const suggested = suggestion.goals.safetyNetMonths;
  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium">Safety net</p>
        <p className="figure text-sm text-muted-foreground">
          {formatMoney(months * monthlyEssentials)}
        </p>
      </div>
      <p className="figure text-4xl font-semibold">
        {months} <span className="text-lg font-medium text-muted-foreground">months</span>
      </p>
      <Slider
        aria-label="Safety net in months"
        min={1}
        max={6}
        step={1}
        value={[months]}
        onValueChange={(v) => {
          const next = Array.isArray(v) ? v[0] : v;
          if (typeof next === "number") onChange({ ...goals, safetyNetMonths: next });
        }}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>1 month</span>
        <span>6 months</span>
      </div>
      <Suggestion
        changed={months !== suggested}
        onUse={() => onChange({ ...goals, safetyNetMonths: suggested })}
      >
        Penny suggests {suggested} months. {suggestion.reasons.safetyNetMonths}
        {currentBuffer !== undefined
          ? ` Opsparing holds ${formatMoney(currentBuffer)} today.`
          : null}
      </Suggestion>
    </div>
  );
}

export function SavingsGoalField({ goals, suggestion, onChange }: FieldProps) {
  const nameId = useId();
  const amountId = useId();
  const dateId = useId();
  const goal = goals.savingsGoal;
  const set = (patch: Partial<Goals["savingsGoal"]>) =>
    onChange({ ...goals, savingsGoal: { ...goal, ...patch } });
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Savings goal</p>
      <div className="space-y-2">
        <label htmlFor={nameId} className="sr-only">
          Goal name
        </label>
        <Input
          id={nameId}
          value={goal.name}
          placeholder="What are you saving for?"
          onChange={(e) => set({ name: e.target.value })}
          className="h-12 rounded-2xl bg-card px-4 text-base"
        />
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <AmountInput
            id={amountId}
            aria-label="Goal amount"
            value={goal.target}
            onChange={(target) => set({ target })}
          />
          <label htmlFor={dateId} className="sr-only">
            Target date
          </label>
          <Input
            id={dateId}
            type="date"
            value={goal.date}
            onChange={(e) => set({ date: e.target.value })}
            className="h-12 w-[9.5rem] rounded-2xl bg-card px-3 text-sm"
          />
        </div>
      </div>
      <Suggestion>
        {suggestion.reasons.savingsGoal} Penny suggests {formatMoney(suggestion.goals.savingsGoal.target)}.
      </Suggestion>
    </div>
  );
}

export function BudgetsField({
  goals,
  suggestion,
  onChange,
}: FieldProps) {
  const total = CATEGORY_ORDER.reduce((s, c) => s + (goals.budgets[c] ?? 0), 0);
  const setBudget = (category: CategoryId, value: number) =>
    onChange({ ...goals, budgets: { ...goals.budgets, [category]: value } });
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium">Monthly budgets</p>
        <p className="figure text-sm text-muted-foreground">{formatMoney(total)} total</p>
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-3xl bg-card ring-1 ring-foreground/[0.06]">
        {CATEGORY_ORDER.map((category) => {
          const value = goals.budgets[category] ?? 0;
          const suggested = suggestion.goals.budgets[category];
          const changed = suggested !== undefined && suggested !== value;
          return (
            <li key={category} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{CATEGORY_LABELS[category]}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {changed ? (
                    <button
                      type="button"
                      className="underline underline-offset-2"
                      onClick={() => setBudget(category, suggested)}
                    >
                      Suggested {formatMoney(suggested)}
                    </button>
                  ) : (
                    (suggestion.reasons.budgets[category] ?? "")
                  )}
                </p>
              </div>
              <Stepper
                label={CATEGORY_LABELS[category]}
                value={value}
                onChange={(v) => setBudget(category, v)}
              />
            </li>
          );
        })}
      </ul>
      <Suggestion>
        Budgets use completed months of connected history. You can adjust each amount.
      </Suggestion>
    </div>
  );
}
