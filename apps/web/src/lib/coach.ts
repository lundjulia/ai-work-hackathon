// Penny's coaching logic. Pure functions, no runtime imports, so `node src/lib/coach.test.mjs` can run it.
// Tone rules: warm, never judging, always a next step. Penny shows what is possible; the family decides.
import type { Category, Goal, Pledge, Receipt } from "./types";

export const TAKEAWAY = /just eat|wolt|pizz|sushi|burger|kebab|takeaway|thai/i;
export const COFFEE = /espresso house|starbucks|baresso|coffee|caf[eé]|latte|cappuccino|kaffebar/i;
export const CANDY = /slik|candy|chokolade|vingummi|haribo|marabou|anthon berg/i;

export const CATEGORY_LABEL: Record<Category, string> = {
  food: "Groceries",
  transport: "Transport",
  home: "Home",
  kids: "Kids",
  leisure: "Fun & leisure",
  other: "Other",
};

export const kr = (n: number) => `${Math.round(n).toLocaleString("en-US")} kr`;

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const word = (n: number) => WORDS[n] ?? String(n);
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

const sameMonth = (d: Date, now: Date) => d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();

/** Where this month's spend stands against a straight-line budget pace. */
export function monthPace(spent: number, budget: number, now = new Date()) {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const day = now.getDate();
  const expected = (budget * day) / daysInMonth;
  const projected = (spent / day) * daysInMonth;
  return { day, daysInMonth, daysLeft: daysInMonth - day, expected, projected, projectedLeft: budget - projected, onTrack: spent <= expected };
}

/** Consecutive days, ending today, where cumulative month spend in `category` stayed at or under pace. */
export function underBudgetStreak(receipts: Receipt[], category: Category, budget: number, now = new Date()): number {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const perDay = new Array(now.getDate() + 1).fill(0);
  for (const r of receipts) {
    const d = new Date(r.date);
    if (r.category === category && sameMonth(d, now) && d <= now) perDay[d.getDate()] += r.total;
  }
  let cum = 0;
  const ok = perDay.map((v, day) => day > 0 && (cum += v) <= (budget * day) / daysInMonth);
  let streak = 0;
  for (let day = now.getDate(); day > 0 && ok[day]; day--) streak++;
  return streak;
}

/** "about two weeks" / "5 days" closer, from kr moved and the goal's monthly pace. */
export function closerBy(kroner: number, goal: Pick<Goal, "monthly">): string {
  const days = Math.round(kroner / (goal.monthly / 30));
  if (days >= 12) return `about ${word(Math.round(days / 7))} weeks`;
  if (days >= 7) return "about a week";
  return days === 1 ? "a day" : `${word(Math.max(days, 1))} days`;
}

/** One practical, specific tip computed from this month's receipts. Rotates by `seed`. */
export function pickTip(receipts: Receipt[], now = new Date(), seed = receipts.length): string {
  const month = receipts.filter((r) => sameMonth(new Date(r.date), now));
  const tips: string[] = [];

  const takeaway = month.filter((r) => TAKEAWAY.test(r.merchant));
  if (takeaway.length >= 2) {
    const avg = takeaway.reduce((s, r) => s + r.total, 0) / takeaway.length;
    const save = Math.max(100, Math.round((2 * (avg - 120)) / 50) * 50); // ~120 kr for a home-cooked family dinner
    tips.push(`Swap two takeaway nights for home cooking and save about ${kr(save)} this month.`);
  }

  const coffee = month.filter((r) => COFFEE.test(r.merchant));
  if (coffee.length >= 2) {
    const avg = coffee.reduce((s, r) => s + r.total, 0) / coffee.length;
    tips.push(`A thermos of coffee from home on four workdays a month saves about ${kr(Math.round((avg * 4) / 10) * 10)}.`);
  }

  // Cheapest kr/kg seen for a product family vs. what was paid most recently.
  const minced = month.flatMap((r) => r.lines).filter((l) => /hakket|fars/i.test(l.name) && l.kgPerUnit);
  if (minced.length >= 2) {
    const perKg = minced.map((l) => l.price / (l.qty * (l.kgPerUnit ?? 1)));
    const best = Math.min(...perKg), worst = Math.max(...perKg);
    if (worst - best >= 10) tips.push(`Minced meat ranged from ${kr(best)}/kg to ${kr(worst)}/kg this month. Grabbing the 1 kg pack is the easy win.`);
  }

  tips.push("Plan three dinners around this week's offers. Compare by kr/kg, not price per pack.");
  return tips[seed % tips.length];
}

/** Active pledge that this receipt touches, e.g. "No coffee this week" + a café receipt. */
export function pledgeHit(r: Receipt, pledges: Pledge[]): Pledge | undefined {
  const text = `${r.merchant} ${r.lines.map((l) => l.name).join(" ")}`;
  return pledges.find(
    (p) =>
      p.active &&
      ((/coffee|kaffe|latte/i.test(p.text) && COFFEE.test(text)) ||
        (/candy|slik|sweets|chocolate|chokolade/i.test(p.text) && CANDY.test(text)) ||
        (/takeaway|take-away|wolt|just eat|pizza/i.test(p.text) && TAKEAWAY.test(text))),
  );
}

export interface CoachContext {
  receipts: Receipt[]; // including the new one
  budgets: Record<Category, number>;
  monthSpent: Record<Category, number>; // from spentThisMonth()
  week: { spent: number; budget: number; left: number; daysLeft: number }; // from foodThisWeek()
  goal: Goal;
  pledges: Pledge[];
  now?: Date;
}

export interface CoachReaction {
  kind: "win" | "nudge";
  mood: "cheer" | "comfort";
  title: string;
  body: string;
  tip: string;
  goalBoost: number; // kr to move toward the goal (0 = none)
}

/** Penny's reaction to a freshly categorized receipt. */
export function reactToReceipt(r: Receipt, c: CoachContext): CoachReaction {
  const now = c.now ?? new Date();
  const cat = r.category;
  const pace = monthPace(c.monthSpent[cat], c.budgets[cat], now);
  const tip = pickTip(c.receipts, now);
  const pledge = pledgeHit(r, c.pledges);
  const weekOk = cat !== "food" || c.week.left >= 0;
  const onTrack = pace.onTrack && weekOk;

  // shortcut: earmarks a quarter of the projected month-end surplus per on-track receipt; a real app would sweep once at month end.
  const goalBoost = onTrack && pace.projectedLeft > 0 ? Math.min(600, Math.max(100, Math.round((pace.projectedLeft * 0.25) / 10) * 10)) : 0;
  const closer = goalBoost ? ` That's ${closerBy(goalBoost, c.goal)} closer to ${c.goal.name.replace(/^summer trip to /i, "")}.` : "";

  const status =
    cat === "food"
      ? `${kr(c.week.left)} left of this week's ${kr(c.week.budget)} food budget, ${c.week.daysLeft} days to go.`
      : `${kr(c.budgets[cat] - c.monthSpent[cat])} left for ${CATEGORY_LABEL[cat].toLowerCase()} this month.`;

  if (pledge) {
    return {
      kind: "nudge",
      mood: "comfort",
      title: "Small slip, no stress",
      body: `You pledged "${pledge.text}". One treat doesn't undo your progress. Tomorrow is a fresh start. ${status}${closer}`,
      tip,
      goalBoost,
    };
  }

  if (onTrack) {
    const streak = underBudgetStreak(c.receipts, cat, c.budgets[cat], now);
    const title =
      streak >= 3
        ? `${cap(streak > 10 ? "every day this month" : `${word(streak)} days`)} under budget${streak > 10 ? "" : " in a row"}. Nice work!`
        : `${CATEGORY_LABEL[cat]} is on track. Nice work!`;
    return { kind: "win", mood: "cheer", title, body: `${status}${closer}`, tip, goalBoost };
  }

  const over = !weekOk ? `${kr(-c.week.left)} over this week's budget` : `${kr(c.monthSpent[cat] - pace.expected)} ahead of the monthly plan`;
  return {
    kind: "nudge",
    mood: "comfort",
    title: "Tough week. That's okay.",
    body: `${CATEGORY_LABEL[cat]} is ${over}. Here's an easy way to get back on track.`,
    tip,
    goalBoost: 0,
  };
}
