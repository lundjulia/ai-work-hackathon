"use client";

import { Button } from "@claude-impact-lab/ui/components/button";
import { Skeleton } from "@claude-impact-lab/ui/components/skeleton";
import { cn } from "@claude-impact-lab/ui/lib/utils";
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  Landmark,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

import { AccountRow } from "@/components/account-row";
import {
  useAccountLabel,
  useHome,
  useHydrated,
  useAutopilotConfigured,
} from "@/components/app-state";
import { BankLogo } from "@/components/brand";
import { Panel, Section } from "@/components/section";
import { formatDate, formatMoney, formatTime } from "@/lib/format";
import type { CategorySpend, HomeVM, Transaction } from "@/lib/view-models";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Good evening";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function AutopilotCard({ home }: { home: HomeVM }) {
  const run = home.latestRun;
  const configured = useAutopilotConfigured();
  const count = home.newActionCount;
  if (count > 0) {
    return (
      <Link
        href="/actions"
        className="group block animate-in rounded-3xl bg-primary p-5 text-primary-foreground shadow-lg shadow-primary/20 duration-500 fade-in slide-in-from-bottom-2"
      >
        <div className="flex items-center gap-2 text-sm opacity-80">
          <Sparkles className="size-4" />
          Autopilot{run ? ` · ${formatDate(run.date, "weekday")}` : ""}
        </div>
        <p className="mt-3 text-2xl font-semibold tracking-tight">
          {count} {count === 1 ? "thing needs" : "things need"} you
        </p>
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm opacity-80">Review and approve in a tap</p>
          <span className="flex size-9 items-center justify-center rounded-full bg-primary-foreground/15 transition group-hover:translate-x-0.5">
            <ArrowRight className="size-4" />
          </span>
        </div>
      </Link>
    );
  }
  return (
    <Panel className="flex items-start gap-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <CheckCircle2 className="size-5" />
      </span>
      <div className="space-y-1">
        <p className="font-medium">
          {run
            ? "All clear"
            : configured
              ? "Ready for your first check"
              : "Autopilot needs setup"}
        </p>
        <p className="text-sm text-muted-foreground">
          {run
            ? `Checked ${formatDate(run.date, "weekday")}${formatTime(run.ranAt) ? ` at ${formatTime(run.ranAt)}` : ""}. ${run.summary}`
            : configured
              ? "Open demo controls to run your first check."
              : "Your accounts are connected. The AI connection is needed before Autopilot can review them."}
        </p>
      </div>
    </Panel>
  );
}

function TotalBlock({ home }: { home: HomeVM }) {
  const { totalDkk, cashDkk, investmentsDkk } = home.total;
  const cashShare = totalDkk > 0 ? (cashDkk / totalDkk) * 100 : 0;
  return (
    <div className="space-y-4 px-1">
      <div>
        <p className="text-sm text-muted-foreground">Total across your banks</p>
        <p className="figure mt-1 text-[2.6rem] leading-none font-semibold">
          {formatMoney(totalDkk)}
        </p>
      </div>
      <div
        className="flex h-2 gap-0.5 overflow-hidden rounded-full"
        aria-hidden="true"
      >
        <span
          className="rounded-full bg-primary"
          style={{ width: `${cashShare}%` }}
        />
        <span className="flex-1 rounded-full bg-chart-3/70" />
      </div>
      <div className="flex justify-between text-sm">
        <span className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-primary" />
          <span className="text-muted-foreground">Cash</span>
          <span className="figure font-medium">{formatMoney(cashDkk)}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-chart-3/70" />
          <span className="text-muted-foreground">Investments</span>
          <span className="figure font-medium">
            {formatMoney(investmentsDkk)}
          </span>
        </span>
      </div>
    </div>
  );
}

function BudgetRow({ c, daysLeft }: { c: CategorySpend; daysLeft: number }) {
  const share = c.budget ? c.spent / c.budget : 0;
  const status = !c.budget
    ? "none"
    : share > 1
      ? "over"
      : share >= 0.8
        ? "near"
        : "ok";
  return (
    <li className="space-y-2 py-3">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate">{c.label}</span>
          {status === "near" || status === "over" ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium",
                status === "over"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-warning/15 text-warning-foreground",
              )}
            >
              <AlertTriangle className="size-3" />
              {status === "over" ? "Over" : `${Math.round(share * 100)}%`}
            </span>
          ) : null}
        </span>
        <span className="figure shrink-0 text-muted-foreground">
          <span className="font-medium text-foreground">
            {formatMoney(c.spent)}
          </span>
          {c.budget ? ` / ${formatMoney(c.budget).replace("DKK ", "")}` : ""}
        </span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        aria-hidden="true"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-700",
            status === "over"
              ? "bg-destructive"
              : status === "near"
                ? "bg-warning"
                : "bg-primary",
          )}
          style={{ width: `${Math.min(share, 1) * 100}%` }}
        />
      </div>
      {status === "near" && daysLeft > 0 ? (
        <p className="text-xs text-muted-foreground">
          {daysLeft} days left this month
        </p>
      ) : null}
    </li>
  );
}

function SpendingPanel({ home }: { home: HomeVM }) {
  const s = home.spending;
  return (
    <Panel>
      <div className="flex items-baseline justify-between">
        <p className="figure text-2xl font-semibold">{formatMoney(s.spent)}</p>
        <p className="text-sm text-muted-foreground">
          of {formatMoney(s.budget)}
        </p>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Spent in {s.monthLabel} · {s.daysLeftInMonth} days left
      </p>
      <ul className="mt-2 divide-y divide-border">
        {s.categories.map((c) => (
          <BudgetRow key={c.category} c={c} daysLeft={s.daysLeftInMonth} />
        ))}
      </ul>
    </Panel>
  );
}

function ForecastPanel({ home }: { home: HomeVM }) {
  const f = home.forecast;
  if (f.available === false)
    return (
      <Panel>
        <p className="text-sm text-muted-foreground">
          There is not enough reliable connected history to forecast your next
          payday.
        </p>
      </Panel>
    );
  return (
    <Panel className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Payday in {f.daysToPayday} days
          </p>
          <p className="text-sm font-medium">{formatDate(f.payday, "long")}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">
            Everyday cash on payday
          </p>
          <p className="figure text-xl font-semibold">
            {formatMoney(Math.round(f.projectedAtPayday))}
          </p>
        </div>
      </div>
      {f.bills.length > 0 ? (
        <ul className="divide-y divide-border border-t border-border">
          {f.bills.map((b) => (
            <li key={b.id} className="flex items-center gap-3 py-3 text-sm">
              <span className="w-12 shrink-0 text-xs text-muted-foreground">
                {formatDate(b.date)}
              </span>
              <span className="min-w-0 flex-1 truncate">{b.name}</span>
              {b.estimated ? (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                  est.
                </span>
              ) : null}
              <span className="figure shrink-0 font-medium">
                {formatMoney(-b.amount)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No bills in the next two weeks.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Forecast from recurring payments and your usual daily spending.
      </p>
    </Panel>
  );
}

function SafetyAndGoal({ home }: { home: HomeVM }) {
  const net = home.safetyNet;
  const netShare =
    net.targetMonths > 0 ? Math.min(net.months / net.targetMonths, 1) : 0;
  const goal = home.savingsGoal;
  const goalShare = goal.target > 0 ? Math.min(goal.saved / goal.target, 1) : 0;
  return (
    <div className="grid grid-cols-2 gap-3">
      <Panel className="space-y-3 p-4">
        <p className="text-sm text-muted-foreground">Safety net</p>
        <p className="figure text-2xl font-semibold">
          {net.months.toFixed(1)}
          <span className="text-sm font-normal text-muted-foreground">
            {" "}
            / {net.targetMonths} mo
          </span>
        </p>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-muted"
          aria-hidden="true"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-700"
            style={{ width: `${netShare * 100}%` }}
          />
        </div>
        <p className="figure text-xs text-muted-foreground">
          {formatMoney(net.bufferDkk)} saved
        </p>
      </Panel>
      <Panel className="space-y-3 p-4">
        <p className="truncate text-sm text-muted-foreground">
          {goal.name || "Savings goal"}
        </p>
        <p className="figure text-2xl font-semibold">
          {Math.round(goalShare * 100)}%
        </p>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-muted"
          aria-hidden="true"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-700"
            style={{ width: `${goalShare * 100}%` }}
          />
        </div>
        <p className="figure truncate text-xs text-muted-foreground">
          {formatMoney(goal.saved)} of{" "}
          {formatMoney(goal.target).replace("DKK ", "")}
        </p>
      </Panel>
    </div>
  );
}

function TransactionRow({ t }: { t: Transaction }) {
  const accountLabel = useAccountLabel();
  const title = t.merchant || t.description || "Transaction";
  return (
    <li className="flex items-center gap-3 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {t.internalTransfer ? (
          <ArrowLeftRight className="size-4" />
        ) : t.status === "pending" ? (
          <Clock className="size-4" />
        ) : (
          <Landmark className="size-4" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {t.internalTransfer
            ? "Between your accounts"
            : accountLabel(t.accountId)}{" "}
          · {formatDate(t.date)}
          {t.status === "pending" ? " · Pending" : ""}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p
          className={cn(
            "figure text-sm font-medium",
            t.amount?.amount > 0 && "text-primary",
          )}
        >
          {formatMoney(t.amount, "DKK", { signed: true })}
        </p>
        {t.originalAmount ? (
          <p className="figure text-xs text-muted-foreground">
            {formatMoney(t.originalAmount)}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function HomeSkeleton() {
  return (
    <div className="space-y-6 px-5 pt-6">
      <Skeleton className="h-10 w-48 rounded-xl" />
      <Skeleton className="h-32 rounded-3xl" />
      <Skeleton className="h-20 w-64 rounded-xl" />
      <Skeleton className="h-48 rounded-3xl" />
    </div>
  );
}

export function HomeScreen() {
  const hydrated = useHydrated();
  const home = useHome();
  if (!hydrated) return <HomeSkeleton />;

  return (
    <main className="space-y-8 px-5 pt-6 pb-10">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {formatDate(home.date, "long")}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting()}, {home.firstName}
          </h1>
        </div>
        <span className="flex size-10 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
          {home.firstName.slice(0, 1)}
        </span>
      </header>

      {home.warnings?.map((warning) => (
        <p
          key={warning}
          role="status"
          className="rounded-2xl bg-warning/15 p-4 text-sm"
        >
          {warning}
        </p>
      ))}
      {home.banks.length === 0 ? (
        <Panel className="space-y-4 text-center">
          <p className="font-medium">Connect a bank to get started</p>
          <p className="text-sm text-muted-foreground">
            Autopilot needs read-only access to at least one account.
          </p>
          <Button
            size="lg"
            className="h-11 w-full"
            nativeButton={false}
            render={<Link href="/onboarding" />}
          >
            Connect banks
          </Button>
        </Panel>
      ) : (
        <>
          <AutopilotCard home={home} />
          <TotalBlock home={home} />

          <Section title="Your banks">
            <div className="space-y-3">
              {home.banks.map(({ bank, accounts, totalDkk }) => (
                <Panel key={bank.id} className="py-4">
                  <div className="flex items-center gap-3 pb-2">
                    <BankLogo bankId={bank.id} className="size-9" />
                    <p className="flex-1 font-medium">{bank.name}</p>
                    <p className="figure font-semibold">
                      {formatMoney(totalDkk)}
                    </p>
                  </div>
                  <div className="divide-y divide-border">
                    {accounts.map((a) => (
                      <AccountRow key={a.id} account={a} />
                    ))}
                  </div>
                </Panel>
              ))}
            </div>
            <p className="px-1 text-xs text-muted-foreground">
              Saxo is counted once, at total account value (cash plus
              positions).
            </p>
          </Section>

          <Section title="Spending this month">
            <SpendingPanel home={home} />
          </Section>

          <Section
            title="Until payday"
            action={<CalendarClock className="size-4 text-muted-foreground" />}
          >
            <ForecastPanel home={home} />
          </Section>

          <Section title="Safety net and goal">
            <SafetyAndGoal home={home} />
          </Section>

          {home.recent.length > 0 ? (
            <Section title="Recent activity">
              <Panel className="py-1">
                <ul className="divide-y divide-border">
                  {home.recent.map((t) => (
                    <TransactionRow key={t.id} t={t} />
                  ))}
                </ul>
              </Panel>
            </Section>
          ) : null}
        </>
      )}
    </main>
  );
}
