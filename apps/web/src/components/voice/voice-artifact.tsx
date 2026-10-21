"use client";

import { Button } from "@claude-impact-lab/ui/components/button";
import { Check, LoaderCircle } from "lucide-react";
import { useState } from "react";

import { ActionCard } from "@/components/actions/action-card";
import { useDemoState } from "@/components/app-state";
import { formatDate, formatNumber } from "@/lib/format";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/view-models";
import type { VoiceArtifact } from "@/lib/voice-artifacts";
import type { ArtifactEntry } from "./use-realtime-voice";

const money = (amount: number) => `${formatNumber(amount)} kr.`;
const riskLabels = { conservative: "Keep it steady", balanced: "A balanced approach", growth: "Comfortable with ups and downs" };
const progress = (percentage: number | null) => Math.min(100, Math.max(0, percentage ?? 0));

function Warnings({ warnings }: { warnings: string[] }) {
  if (!warnings.length) return null;
  return <div className="mt-4 space-y-1 text-xs leading-relaxed text-muted-foreground">{warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>;
}

function BudgetArtifact({ artifact }: { artifact: Extract<VoiceArtifact, { kind: "budget" }> }) {
  const [selected, setSelected] = useState("all");
  const rows = selected === "all" ? artifact.rows : artifact.rows.filter((row) => row.category === selected);
  return <>
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground">{formatDate(artifact.startDate)} to {formatDate(artifact.endDate)}</p>
      {artifact.rows.length > 1 && <select aria-label="Choose budget category" value={selected} onChange={(event) => setSelected(event.target.value)} className="max-w-[55%] rounded-xl border bg-background px-2 py-1 text-xs">
        <option value="all">All categories</option>
        {artifact.rows.map((row) => <option key={row.category} value={row.category}>{row.label}</option>)}
      </select>}
    </div>
    <div className="mt-5 space-y-5">{rows.map((row) => <div key={row.category}>
      <div className="flex justify-between gap-3 text-sm"><span className="font-medium">{row.label}</span><span>{row.remainingDkk >= 0 ? `${money(row.remainingDkk)} left` : `${money(-row.remainingDkk)} over`}</span></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-primary/10" role="meter" aria-label={`${row.label} budget used`} aria-valuenow={progress(row.percentUsed)} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full ${row.remainingDkk < 0 ? "bg-amber-500" : "bg-primary"}`} style={{ width: `${progress(row.percentUsed)}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{money(row.spentDkk)} spent of {money(row.limitDkk)}</p>
    </div>)}</div>
    {!rows.length && <p className="mt-3 text-sm text-muted-foreground">There isn't a saved budget for this category yet.</p>}
    <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{artifact.note}</p>
    <Warnings warnings={artifact.warnings} />
  </>;
}

function GoalsArtifact({ artifact }: { artifact: Extract<VoiceArtifact, { kind: "goals" }> }) {
  const goal = artifact.savingsGoal;
  return <>
    {goal && <div className="rounded-2xl bg-primary/5 p-4">
      <p className="text-sm font-medium">{goal.name}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{money(goal.savedDkk)} <span className="text-sm font-normal text-muted-foreground">of {money(goal.targetDkk)}</span></p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-primary/10"><div className="h-full rounded-full bg-primary" style={{ width: `${progress(goal.percentDone)}%` }} /></div>
      <p className="mt-2 text-xs text-muted-foreground">{goal.remainingDkk > 0 ? `${money(goal.remainingDkk)} to go` : "You've reached your goal"} · {formatDate(goal.targetDate)}</p>
    </div>}
    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
      <div><dt className="text-xs text-muted-foreground">Money kept for surprises</dt><dd className="mt-1 font-medium">{money(artifact.safetyNet.bufferDkk)}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Your safety goal</dt><dd className="mt-1 font-medium">{artifact.safetyNet.targetMonths} months</dd></div>
    </dl>
    <Warnings warnings={artifact.warnings} />
  </>;
}

function ForecastArtifact({ artifact }: { artifact: Extract<VoiceArtifact, { kind: "forecast" }> }) {
  const points = artifact.points;
  const amounts = [...points.map((point) => point.balanceDkk), artifact.minimumBalanceDkk];
  const minimum = Math.min(...amounts, 0);
  const maximum = Math.max(...amounts, 1);
  const y = (amount: number) => 96 - ((amount - minimum) / (maximum - minimum)) * 80;
  const coordinates = points.map((point, index) => `${12 + (index / Math.max(1, points.length - 1)) * 296},${y(point.balanceDkk)}`).join(" ");
  return <>
    <p className="text-xs text-muted-foreground">Available for everyday spending</p>
    <p className="mt-1 text-2xl font-semibold tracking-tight">{money(artifact.balanceTodayDkk)}</p>
    {artifact.reliable && points.length > 1 && <>
      <svg viewBox="0 0 320 112" className="mt-4 w-full" role="img" aria-label={`Cash forecast. Lowest expected balance ${money(artifact.lowestBalanceDkk ?? artifact.balanceTodayDkk)}. Your minimum balance is ${money(artifact.minimumBalanceDkk)}.`}>
        <line x1="12" x2="308" y1={y(artifact.minimumBalanceDkk)} y2={y(artifact.minimumBalanceDkk)} stroke="currentColor" strokeDasharray="4 4" opacity="0.3" />
        <polyline points={coordinates} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="flex justify-between text-xs text-muted-foreground"><span>{formatDate(points[0]?.date)}</span><span>{formatDate(points.at(-1)?.date)}</span></div>
      <p className="mt-3 text-sm">Lowest expected balance <span className="font-medium">{money(artifact.lowestBalanceDkk ?? artifact.balanceTodayDkk)}</span>{artifact.lowestOn ? ` on ${formatDate(artifact.lowestOn)}` : ""}.</p>
      <p className="mt-1 text-xs text-muted-foreground">Dotted line: the {money(artifact.minimumBalanceDkk)} you want to keep available.</p>
    </>}
    {!artifact.reliable && <p className="mt-3 text-sm text-muted-foreground">I need up-to-date account information before I can give you a useful forecast.</p>}
    {artifact.bills.length > 0 && <div className="mt-4 border-t pt-3"><p className="mb-2 text-xs font-medium text-muted-foreground">Coming up</p>{artifact.bills.slice(0, 4).map((bill, index) => <div key={`${bill.name}_${index}`} className="flex justify-between gap-3 py-1 text-xs"><span>{bill.name} · {formatDate(bill.date)}{bill.estimated ? " · estimated" : ""}</span><span className="shrink-0">{money(bill.amountDkk)}</span></div>)}</div>}
    <Warnings warnings={artifact.warnings} />
  </>;
}

function SettingsArtifact({ entry, onConfirm }: { entry: ArtifactEntry; onConfirm: () => void }) {
  if (entry.artifact.kind !== "settings") return null;
  const { goals } = entry.artifact;
  const saving = entry.confirmationState === "saving";
  const saved = entry.confirmationState === "saved";
  const stale = entry.confirmationState === "stale";
  return <>
    <p className="text-sm text-muted-foreground">Here's what we agreed. Save it when it looks right, or tell me what you'd like to change.</p>
    <dl className="mt-4 space-y-3 text-sm">
      <div className="flex justify-between gap-4"><dt>Monthly take-home pay</dt><dd className="font-medium">{money(goals.monthlyIncome)}</dd></div>
      <div className="flex justify-between gap-4"><dt>Safety cushion</dt><dd className="font-medium">{goals.safetyNetMonths} months</dd></div>
      <div className="flex justify-between gap-4"><dt>Comfort with risk</dt><dd className="text-right font-medium">{riskLabels[goals.riskTolerance]}</dd></div>
      <div className="border-t pt-3"><dt className="font-medium">{goals.savingsGoal.name}</dt><dd className="mt-1 text-muted-foreground">{money(goals.savingsGoal.target)} by {formatDate(goals.savingsGoal.date)}</dd></div>
    </dl>
    <div className="mt-4 rounded-2xl bg-muted/40 p-3"><p className="mb-2 text-xs font-medium text-muted-foreground">Monthly spending plan</p><dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">{CATEGORY_ORDER.map((category) => <div key={category} className="flex justify-between gap-2"><dt className="text-muted-foreground">{CATEGORY_LABELS[category]}</dt><dd className="shrink-0 font-medium">{money(goals.budgets[category])}</dd></div>)}</dl></div>
    <Button className="mt-5 h-11 w-full rounded-2xl" disabled={saving || saved || stale} onClick={onConfirm}>
      {saving ? <LoaderCircle className="size-4 animate-spin" /> : saved ? <Check className="size-4" /> : null}
      {saving ? "Saving your plan" : saved ? "Plan saved" : stale ? "Ask for the latest plan" : "Save my plan"}
    </Button>
    {entry.message && <p role={entry.confirmationState === "error" ? "alert" : "status"} className={`mt-2 text-xs leading-relaxed ${entry.confirmationState === "error" || stale ? "text-destructive" : "text-muted-foreground"}`}>{entry.message}</p>}
  </>;
}

export function VoiceArtifactCard({ entry, onConfirm, onDecision }: {
  entry: ArtifactEntry;
  onConfirm: () => void;
  onDecision: (id: string, decision: "approved" | "dismissed") => void;
}) {
  const state = useDemoState();
  const { artifact } = entry;
  if (artifact.kind === "action") {
    const item = state.actions.find((action) => action.id === artifact.action.id);
    if (!item) return <article className="rounded-3xl border bg-card p-5 text-sm text-muted-foreground">This suggestion has changed. Ask Penny to check your latest updates.</article>;
    return <ActionCard item={item} onDecision={onDecision} />;
  }
  return <article className="rounded-3xl bg-card p-5 ring-1 ring-foreground/[0.06]" aria-label={artifact.title}>
    <h3 className="mb-3 text-base font-semibold tracking-tight">{artifact.title}</h3>
    {artifact.kind === "budget" && <BudgetArtifact artifact={artifact} />}
    {artifact.kind === "goals" && <GoalsArtifact artifact={artifact} />}
    {artifact.kind === "forecast" && <ForecastArtifact artifact={artifact} />}
    {artifact.kind === "settings" && <SettingsArtifact entry={entry} onConfirm={onConfirm} />}
  </article>;
}
