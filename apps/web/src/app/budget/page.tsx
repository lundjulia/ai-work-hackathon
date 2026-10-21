"use client";

import { PennySvg } from "@/components/avatar/coach";
import { useApp, spentThisMonth } from "@/lib/store";

const kr = (n: number) => `${Math.round(n).toLocaleString("en-US")} kr`;

export default function BudgetPage() {
  const receipts = useApp((s) => s.receipts);
  const now = new Date();
  const spent = spentThisMonth(receipts, now);
  const month = now.toLocaleString("en-GB", { month: "long" });

  const groups = [
    { label: "Food & groceries", value: spent.food, color: "var(--forest)" },
    { label: "Home & bills", value: spent.home, color: "var(--mid-green)" },
    { label: "Transport", value: spent.transport, color: "var(--sage)" },
    { label: "Kids & fun", value: spent.kids + spent.leisure, color: "var(--mustard)" },
    { label: "Other", value: spent.other, color: "#DADAD5" },
  ];
  const total = groups.reduce((s, g) => s + g.value, 0);
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0);

  // Donut: r=40 → circumference ≈ 251.3; small gap between segments.
  const C = 2 * Math.PI * 40;
  let offset = 0;
  const arcs = groups
    .filter((g) => g.value > 0)
    .map((g) => {
      const len = (g.value / total) * C;
      const arc = { ...g, dash: `${Math.max(0, len - 1.5)} ${C}`, offset: -offset };
      offset += len;
      return arc;
    });

  // Projected full-month food spend, 10% of it, rounded to 10 kr.
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const projectedFood = (spent.food / now.getDate()) * daysInMonth;
  const lever = Math.round((projectedFood * 0.1) / 10) * 10;
  const foodIsBiggest = groups.every((g) => g.value <= spent.food);

  return (
    <main className="flex flex-col gap-4 px-4 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Where our money goes</h1>
        <p className="text-sm text-muted-foreground">
          {month} {now.getFullYear()} · all household spending
        </p>
      </header>

      <section className="space-y-5 rounded-[20px] bg-card p-5">
        <div className="relative mx-auto size-56">
          <svg viewBox="0 0 100 100" className="size-full -rotate-90" role="img" aria-label={`${kr(total)} spent in ${month}`}>
            <circle cx="50" cy="50" r="40" fill="none" stroke="var(--muted)" strokeWidth="14" />
            {arcs.map((a) => (
              <circle
                key={a.label}
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke={a.color}
                strokeWidth="14"
                strokeDasharray={a.dash}
                strokeDashoffset={a.offset}
                className="transition-all duration-700 motion-reduce:transition-none"
              />
            ))}
          </svg>
          <div className="absolute inset-0 grid place-content-center text-center">
            <p className="text-2xl font-extrabold tabular-nums">{kr(total)}</p>
            <p className="text-xs text-muted-foreground">spent in {month}</p>
          </div>
        </div>

        <ul className="space-y-2.5">
          {groups.map((g) => (
            <li key={g.label} className="flex items-center gap-3 text-sm">
              <span className="size-2.5 rounded-full" style={{ background: g.color }} aria-hidden />
              <span className="flex-1">{g.label}</span>
              <span className="tabular-nums text-muted-foreground">{kr(g.value)}</span>
              <span className="w-10 text-right font-bold tabular-nums">{pct(g.value)}%</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex gap-3 rounded-[20px] bg-forest p-4 text-white">
        <div className="relative shrink-0">
          <PennySvg px={44} mood="think" />
          <span className="absolute -right-1 bottom-1 rounded-full bg-white px-1 text-[9px] font-bold text-forest">AI</span>
        </div>
        <div className="space-y-1 text-sm">
          <p className="font-bold">{foodIsBiggest ? "Food is your biggest lever" : "Food is where small swaps add up"}</p>
          <p className="text-white/75">
            Cutting groceries by 10% would add about <span className="font-semibold text-sage">{kr(lever)}</span> a month to
            your savings goal. You decide if it&apos;s worth it.
          </p>
        </div>
      </section>
    </main>
  );
}
