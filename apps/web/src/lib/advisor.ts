// Pure advisor helpers shared by /advisor, /goals and /api/advisor. Type-only imports so
// `node src/lib/advisor.check.mjs` can run this file directly (Node type stripping).
import type { Category, Goal, Pledge, Profile, Receipt } from "./types";

export const CATEGORIES: Category[] = ["food", "transport", "home", "kids", "leisure", "other"];

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Compact snapshot of the family's data sent with each chat request. */
export interface AdvisorContext {
  familyName: string;
  income: number;
  riskTolerance: Profile["riskTolerance"];
  safetyNet: { target: number; current: number };
  budgets: Record<Category, number>;
  spentThisMonth: Record<Category, number>;
  goal: Goal;
  pledges: string[];
  recent: { merchant: string; date: string; total: number; category: Category; items: string[] }[];
}

export const MAX_MESSAGE_CHARS = 1000;
export const MAX_MESSAGES = 20;

export function buildContext(
  profile: Profile,
  goal: Goal,
  pledges: Pledge[],
  receipts: Receipt[],
  spent: Record<Category, number>,
): AdvisorContext {
  return {
    familyName: profile.familyName,
    income: profile.income,
    riskTolerance: profile.riskTolerance,
    safetyNet: { target: profile.safetyNetTarget, current: profile.safetyNetCurrent },
    budgets: profile.budgets,
    spentThisMonth: spent,
    goal,
    pledges: pledges.filter((p) => p.active).map((p) => p.text).slice(0, 10),
    recent: [...receipts]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 8)
      .map((r) => ({
        merchant: r.merchant,
        date: r.date.slice(0, 10),
        total: r.total,
        category: r.category,
        items: r.lines.slice(0, 5).map((l) => l.name),
      })),
  };
}

export const kr = (n: number) => `${Math.round(n).toLocaleString("en-US")} kr`;

const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);

/** Free money per month after budgets and the savings goal. */
export function monthlyRoom(c: Pick<AdvisorContext, "income" | "budgets" | "goal">) {
  return c.income - sum(c.budgets) - c.goal.monthly;
}

/** Splits a trailing `PLEDGE: <text>` line off the model output. Hides a half-streamed one too. */
export function splitPledge(text: string): { text: string; pledge: string | null } {
  const m = text.match(/\n?\s*PLEDGE:\s*([\s\S]*)$/);
  if (!m) return { text, pledge: null };
  const pledge = m[1].split("\n")[0].trim().slice(0, 80);
  return { text: text.slice(0, m.index).trimEnd(), pledge: pledge || null };
}

export type Intent = "invest" | "pledge" | "afford" | "save" | "spend" | "safety" | "risk" | "budget" | "hello";

// Order matters: "not spending on coffee" is a pledge, not a spend question; invest beats everything.
const INTENTS: [Intent, RegExp][] = [
  ["invest", /invest|stock|share|aktie|fund|fond|crypto|bitcoin|etf|bond|obligation/i],
  ["pledge", /^(no|ingen|intet|not|stop|skip|drop)\b|\bno\b .* this (week|month)|not (buy|spend)|won'?t (buy|spend)|pledge|i promise|\blover\b/i],
  ["afford", /afford|råd til|can we buy|kan vi købe/i],
  ["safety", /safety net|buffer|emergency|nødopsparing|irregular|unexpected|uforudset/i],
  ["risk", /risk/i],
  ["budget", /budget|limit|auto/i],
  ["save", /sav|spare|trip|goal|mål|ferie|holiday|vacation/i],
  ["spend", /where|money go|spent|spend|brugt|forbrug|went/i],
];

export function detectIntent(text: string): Intent {
  return INTENTS.find(([, re]) => re.test(text))?.[0] ?? "hello";
}

const CAT_LABEL: Record<Category, string> = {
  food: "food", transport: "transport", home: "home", kids: "kids", leisure: "fun & leisure", other: "other stuff",
};

/** Deterministic, data-driven reply used when Claude is unavailable. Same PLEDGE convention. */
export function fallbackReply(messages: ChatMessage[], c: AdvisorContext): string {
  const q = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const room = monthlyRoom(c);
  const g = c.goal;
  const left = Math.max(0, g.target - g.saved);
  const netGap = Math.max(0, c.safetyNet.target - c.safetyNet.current);

  switch (detectIntent(q)) {
    case "invest":
      return [
        "Great question, and I love that you're thinking ahead! 💛 But I'm an AI coach, not an investment adviser, so I never pick stocks, funds or products for you.",
        netGap > 0
          ? `What I can say: most families build a safety net first. Yours is at ${kr(c.safetyNet.current)} of ${kr(c.safetyNet.target)}, so ${kr(netGap)} to go.`
          : `Your safety net is full (${kr(c.safetyNet.current)}). Nice work!`,
        room > 0
          ? `Right now about ${kr(room)} a month is left after budgets and your ${g.emoji} goal. That's what's possible to set aside.`
          : "Right now your budgets and goal use up the whole income, so there's no extra room yet.",
        `Your risk tolerance is "${c.riskTolerance}": ${riskText(c.riskTolerance)} What to do with it is the family's call. A bank adviser can help with specifics.`,
      ].join("\n\n");
    case "pledge": {
      const pledge = q.trim().replace(/\s+/g, " ").slice(0, 80);
      return `Love it! 💪 "${pledge}" — small swaps add up fast. I'll cheer you on all week, and every krone saved can go straight to ${g.emoji} ${g.name}.\nPLEDGE: ${pledge}`;
    }
    case "afford": {
      const amount = Number(q.match(/(\d[\d.,]*)\s*(kr|dkk)?/i)?.[1]?.replace(/[.,](?=\d{3}\b)/g, "").replace(",", ".") ?? NaN);
      const budgetLeft = sum(c.budgets) - sum(c.spentThisMonth);
      if (!Number.isFinite(amount))
        return `Tell me the price and I'll check! This month you have ${kr(budgetLeft)} left across all budgets, plus about ${kr(Math.max(0, room))} of free room per month.`;
      if (amount <= room)
        return `Yes, ${kr(amount)} fits! You have about ${kr(room)} of free room a month after budgets and your ${g.emoji} goal. The family decides, of course 😊`;
      const months = room > 0 ? Math.ceil(amount / room) : null;
      return `${kr(amount)} is more than this month's free room (${kr(Math.max(0, room))}).${months ? ` Put aside ${kr(room)} a month and you'd have it in about ${months} months.` : " Trimming a budget a little could make room."} No stress, it's just a plan!`;
    }
    case "save": {
      const months = g.monthly > 0 ? Math.ceil(left / g.monthly) : null;
      const under = c.budgets.food - c.spentThisMonth.food;
      return [
        `${g.emoji} ${g.name}: ${kr(g.saved)} saved of ${kr(g.target)}, so ${kr(left)} to go.`,
        months ? `At ${kr(g.monthly)} a month you'll get there in about ${months} months. 🎉` : "Set a monthly amount on the Goals page and I'll show when you'll get there.",
        room > 0 ? `There's about ${kr(room)} of free room a month. Adding even ${kr(Math.min(room, 500))} gets you there sooner.` : "",
        under > 0 ? `You're ${kr(under)} under the food budget this month. Moving that to the goal would be a nice win!` : "",
      ].filter(Boolean).join("\n\n");
    }
    case "spend": {
      const top = CATEGORIES.filter((k) => c.spentThisMonth[k] > 0).sort((a, b) => c.spentThisMonth[b] - c.spentThisMonth[a]);
      if (!top.length) return "No receipts this month yet! Connect Nexi and I'll show where the money goes. 🧾";
      const lines = top.map((k) => {
        const s = c.spentThisMonth[k], b = c.budgets[k];
        return `• ${CAT_LABEL[k]}: ${kr(s)} of ${kr(b)}${s > b ? " (a bit over, no judgement!)" : ""}`;
      });
      return `This month so far:\n${lines.join("\n")}\n\nTotal ${kr(sum(c.spentThisMonth))} of ${kr(sum(c.budgets))}. Biggest piece: ${CAT_LABEL[top[0]]}.`;
    }
    case "safety":
      return `A safety net is money for surprises: a broken washing machine, the car, a dentist bill. Many families aim for ~3 months of fixed costs. Yours: ${kr(c.safetyNet.current)} of ${kr(c.safetyNet.target)}${netGap > 0 ? `, ${kr(netGap)} to go` : " — full!"}. Tip: also set aside a little each month for yearly bills (insurance, car), so they never surprise you.`;
    case "risk":
      return `Risk tolerance means how much ups and downs you can live with. Yours is "${c.riskTolerance}": ${riskText(c.riskTolerance)} I don't pick investments for you — the family decides.`;
    case "budget":
      return `Your monthly budgets add up to ${kr(sum(c.budgets))} of ${kr(c.income)} income. Tap "Auto budget" on the Goals page and I'll suggest new limits from your receipts. You decide whether to keep them!`;
    default:
      return `Hej ${c.familyName}s! 👋 I'm your AI money coach. Ask me where the money went, how much you can save for ${g.emoji} ${g.name}, or tell me a pledge like "No candy this week!"`;
  }
}

export function riskText(r: Profile["riskTolerance"]) {
  return {
    low: "you prefer money that stays steady, even if it grows slowly.",
    medium: "you're OK with some ups and downs for a chance of more growth.",
    high: "you can live with big swings and only use money you won't need for years.",
  }[r];
}

/**
 * Auto budget: last month's spend per category +5%, rounded up to 100 kr. Falls back to this
 * month projected to a full month when last month has no receipts. Categories with no data keep
 * their budget. Total is capped at income − goal.monthly − 10% (safety net), scaled down if needed.
 */
export function suggestBudgets(receipts: Receipt[], profile: Profile, goal: Goal, now = new Date()) {
  const byMonth = (y: number, m: number) => {
    const out = Object.fromEntries(CATEGORIES.map((k) => [k, 0])) as Record<Category, number>;
    for (const r of receipts) {
      const d = new Date(r.date);
      if (d.getFullYear() === y && d.getMonth() === m) out[r.category] += r.total;
    }
    return out;
  };
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  let base = byMonth(prev.getFullYear(), prev.getMonth());
  if (sum(base) === 0) {
    const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const cur = byMonth(now.getFullYear(), now.getMonth());
    base = Object.fromEntries(CATEGORIES.map((k) => [k, (cur[k] / now.getDate()) * days])) as Record<Category, number>;
  }
  const up = (n: number) => Math.ceil(n / 100) * 100;
  const out = Object.fromEntries(
    CATEGORIES.map((k) => [k, base[k] > 0 ? up(base[k] * 1.05) : profile.budgets[k]]),
  ) as Record<Category, number>;
  const cap = profile.income * 0.9 - goal.monthly;
  const total = sum(out);
  if (total > cap && cap > 0) for (const k of CATEGORIES) out[k] = Math.floor((out[k] * cap) / total / 100) * 100;
  return out;
}
