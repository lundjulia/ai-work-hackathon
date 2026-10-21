// Run: node src/lib/coach.test.mjs  (Node 23+ strips the TS types of coach.ts)
import assert from "node:assert/strict";
import { monthPace, underBudgetStreak, closerBy, pickTip, reactToReceipt } from "./coach.ts";

const now = new Date(2026, 9, 15, 12); // 15 Oct, 31-day month
const p = monthPace(2000, 6200, now);
assert.equal(p.expected, 3000);
assert.equal(Math.round(p.projected), 4133);
assert.equal(p.daysLeft, 16);
assert.equal(p.onTrack, true);
assert.equal(monthPace(3500, 6200, now).onTrack, false);

const r = (id, day, total, category = "food", merchant = "Netto") => ({
  id, merchant, chain: "Other", date: new Date(2026, 9, day, 10).toISOString(), total, lines: [], category, source: "nexi",
});
// budget 3100 -> 100 kr/day pace. Day 1-12 cheap, day 13 big spike, 14-15 cheap: cumulative back under? 13*100=1300.
const rs = [r("a", 1, 50), r("b", 13, 900), r("c", 14, 10), r("d", 15, 10)];
// cumulative: d13 = 950 <= 1300, d14 = 960, d15 = 970 -> all 15 days ok
assert.equal(underBudgetStreak(rs, "food", 3100, now), 15);
assert.equal(underBudgetStreak([r("x", 2, 500), ...rs], "food", 3100, now), 1); // d13 1450>1300, d14 1460>1400, d15 1470<=1500

assert.equal(closerBy(560, { monthly: 1200 }), "about two weeks");
assert.equal(closerBy(80, { monthly: 1200 }), "two days");

const takeaways = [r("t1", 3, 300, "food", "Wolt · Pizza"), r("t2", 9, 260, "food", "Just Eat")];
assert.match(pickTip(takeaways, now, 0), /^Swap two takeaway nights for home cooking and save about 300 kr this month\.$/);

const ctx = {
  receipts: rs, budgets: { food: 3100, transport: 0, home: 0, kids: 0, leisure: 1000, other: 0 },
  monthSpent: { food: 970, transport: 0, home: 0, kids: 0, leisure: 80, other: 0 },
  week: { spent: 300, budget: 716, left: 416, daysLeft: 3 },
  goal: { name: "Summer trip to Italy", emoji: "", target: 15000, saved: 6400, monthly: 1200 },
  pledges: [], now,
};
const win = reactToReceipt(rs[3], ctx);
assert.equal(win.kind, "win");
assert.ok(win.goalBoost > 0 && win.body.includes("closer to Italy"), win.body);

const latte = { ...r("l", 15, 80, "leisure", "Espresso House"), lines: [{ name: "Caffe latte", qty: 1, price: 80 }] };
const slip = reactToReceipt(latte, { ...ctx, pledges: [{ id: "1", text: "No coffee this week", createdAt: "", active: true }] });
assert.equal(slip.mood, "comfort");
assert.match(slip.body, /No coffee this week/);

const over = reactToReceipt(rs[3], { ...ctx, week: { ...ctx.week, left: -120 } });
assert.equal(over.kind, "nudge");
assert.equal(over.goalBoost, 0);
console.log("coach ok");
