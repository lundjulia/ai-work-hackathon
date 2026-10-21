"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, Loader2 } from "lucide-react";
import { PennySvg, type CoachMood } from "@/components/avatar/coach";
import { useApp, foodThisWeek } from "@/lib/store";
import { useSimulateReceipt } from "@/lib/nexi/simulate";
import type { AppNotification, Category, Receipt } from "@/lib/types";
import { cn } from "@/lib/utils";

const kr = (n: number) => `${Math.round(n).toLocaleString("en-US")} kr`;

const CAT_LABEL: Record<Category, string> = {
  food: "Groceries",
  transport: "Transport",
  home: "Home & bills",
  kids: "Kids",
  leisure: "Fun",
  other: "Other",
};

const MOOD: Record<AppNotification["kind"], CoachMood> = { win: "cheer", nudge: "comfort", tip: "think", receipt: "happy" };

/** Tweens a number toward its target so changes feel alive. */
function useTween(target: number, ms = 700) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const cur = a + (target - a) * (1 - (1 - p) ** 3);
      from.current = cur;
      setV(cur);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  return Math.ceil(((t.getTime() - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7);
}

function weekLabel(now: Date) {
  const mon = new Date(now);
  mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const m = (d: Date) => d.toLocaleString("en-GB", { month: "short" });
  const range = m(mon) === m(sun) ? `${mon.getDate()}–${sun.getDate()} ${m(sun)}` : `${mon.getDate()} ${m(mon)} – ${sun.getDate()} ${m(sun)}`;
  return `Week ${isoWeek(now)} · ${range}`;
}

function dayLabel(iso: string, now: Date) {
  const d = new Date(iso);
  const days = Math.round((new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 864e5);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function Bar({ pct, className, track }: { pct: number; className?: string; track?: string }) {
  return (
    <div className={cn("h-2.5 w-full overflow-hidden rounded-full", track ?? "bg-pale-green")} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={cn("h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none", className ?? "bg-forest")}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

function ReceiptRow({ r, now }: { r: Receipt; now: Date }) {
  const name = r.chain === "Other" ? r.merchant : r.chain;
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold",
          r.category === "food" ? "bg-pale-green text-forest" : "bg-mustard/40 text-foreground",
        )}
        aria-hidden
      >
        {name[0]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{name}</p>
        <p className="text-xs text-muted-foreground">
          {CAT_LABEL[r.category]} · {dayLabel(r.date, now)}
        </p>
      </div>
      <span className="font-bold tabular-nums">-{kr(r.total)}</span>
    </li>
  );
}

export default function Home() {
  const { goal, profile, receipts, notifications } = useApp();
  const { simulate, busy } = useSimulateReceipt();
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const week = foodThisWeek(receipts, profile.budgets.food, now);
  const leftTween = useTween(week.left);
  const savedTween = useTween(goal.saved);
  const toGo = Math.max(0, goal.target - goal.saved);
  const weeks = goal.monthly > 0 ? Math.ceil(toGo / ((goal.monthly * 12) / 52)) : null;

  const latest = notifications[0];
  const unread = notifications.some((n) => !n.read);
  const win = notifications.find((n) => n.kind === "win");
  const tip = notifications.find((n) => n.kind === "tip");
  const recent = [...receipts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);

  return (
    <main className="flex flex-col gap-4 px-4 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{greeting}</h1>
          <p className="text-sm text-muted-foreground">{weekLabel(now)}</p>
        </div>
        <Link
          href="/notifications"
          className="relative grid size-11 place-items-center rounded-full bg-white shadow-sm"
          aria-label={unread ? "Notifications, unread" : "Notifications"}
        >
          <Bell className="size-5" />
          {unread && <span className="absolute top-2 right-2.5 size-2.5 rounded-full bg-mustard ring-2 ring-white" />}
        </Link>
      </header>

      {/* Weekly food budget hero */}
      <section className="space-y-3 rounded-[20px] bg-forest p-5 text-white">
        <p className="text-sm text-white/75">Food budget left this week</p>
        <p className="flex items-baseline gap-2">
          <span className={cn("text-4xl font-extrabold tabular-nums tracking-tight", week.left < 0 && "text-mustard")}>
            {week.left < 0 && "-"}
            {kr(Math.abs(leftTween))}
          </span>
          <span className="text-sm text-white/60">of {kr(week.budget)}</span>
        </p>
        <Bar pct={(Math.max(0, leftTween) / week.budget) * 100} className="bg-sage" track="bg-white/15" />
        <div className="flex justify-between text-sm text-white/75">
          <span>{kr(week.spent)} spent</span>
          <span>
            {week.daysLeft} {week.daysLeft === 1 ? "day" : "days"} left
          </span>
        </div>
      </section>

      {/* Penny card */}
      <section className="flex gap-3 rounded-[20px] bg-card p-4" aria-live="polite">
        <div key={latest?.id} className={cn("relative shrink-0", latest?.kind === "win" ? "coach-bounce" : "coach-float")}>
          <PennySvg px={44} mood={latest ? MOOD[latest.kind] : "happy"} />
          <span className="absolute -right-1 bottom-1 rounded-full bg-forest px-1 text-[9px] font-bold text-white">AI</span>
        </div>
        <div className="space-y-1 text-sm">
          <p className="font-bold">
            {win
              ? `${win.title} ${win.body}`
              : week.left >= 0
                ? "You're on track with food this week. Nice work!"
                : "Tough week for food. No stress, small swaps will get you back."}
          </p>
          <p className="text-muted-foreground">
            {tip ? `${tip.title} ${tip.body}` : "Swap two takeaway nights for home cooking and save about 300 kr this month."}
          </p>
        </div>
      </section>

      {/* Savings goal (compact) */}
      <Link href="/goals" className="space-y-2 rounded-[20px] bg-card p-4">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="truncate font-bold">
            {goal.emoji} {goal.name}
          </span>
          <span className="shrink-0 text-muted-foreground">{toGo > 0 ? `${kr(toGo)} to go` : "Reached! 🎉"}</span>
        </div>
        <Bar pct={(savedTween / goal.target) * 100} />
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">{kr(savedTween)}</span> of {kr(goal.target)}
          {toGo > 0 && weeks !== null && ` · ~${weeks} weeks at this pace`}
        </p>
      </Link>

      {/* Latest receipts */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="font-bold">
            Latest receipts <span className="text-xs font-normal text-muted-foreground">· via Nexi Smart Receipt</span>
          </h2>
          <Link href="/receipts" className="text-sm font-semibold text-mid-green">
            See all
          </Link>
        </div>
        <ul className="divide-y divide-border/60 rounded-[20px] bg-card">
          {recent.map((r) => (
            <ReceiptRow key={r.id} r={r} now={now} />
          ))}
          {recent.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">No receipts yet.</li>}
        </ul>
        <div className="flex justify-center pt-1">
          <button
            onClick={() => simulate()}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-white disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : "🧾"} Simulate incoming receipt
          </button>
        </div>
      </section>
    </main>
  );
}
