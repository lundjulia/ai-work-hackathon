// Self-check for the advisor fallback. Run: node src/lib/advisor.check.mjs (Node >= 23, type stripping)
import assert from "node:assert/strict";
import { detectIntent, fallbackReply, splitPledge, suggestBudgets } from "./advisor.ts";

const cases = {
  "Where did our money go this month?": "spend",
  "How much can we save for the trip?": "save",
  "Should we invest in stocks?": "invest",
  "Skal vi købe aktier?": "invest",
  "No candy this week!": "pledge",
  "Not spending money on coffee": "pledge",
  "Can we afford a 4.000 kr bike?": "afford",
  "What is a safety net?": "safety",
  "What does risk tolerance mean?": "risk",
  "Hi!": "hello",
};
for (const [q, want] of Object.entries(cases)) assert.equal(detectIntent(q), want, q);

const budgets = { food: 6500, transport: 2000, home: 3000, kids: 1500, leisure: 1200, other: 800 };
const ctx = {
  familyName: "Jensen", income: 52000, riskTolerance: "low", safetyNet: { target: 30000, current: 12000 },
  budgets, spentThisMonth: { ...budgets, food: 312.5, transport: 0, home: 0, kids: 0, leisure: 0, other: 0 },
  goal: { name: "Trip", emoji: "🏖️", target: 15000, saved: 6200, monthly: 1500 }, pledges: [], recent: [],
};
const ask = (q) => fallbackReply([{ role: "user", content: q }], ctx);

const pledge = splitPledge(ask("No candy this week!"));
assert.equal(pledge.pledge, "No candy this week!");
assert.ok(!pledge.text.includes("PLEDGE"));
assert.equal(splitPledge("Hello\nPLE").pledge, null);
assert.equal(splitPledge("Hi\nPLEDGE:").text, "Hi"); // half-streamed pledge line is hidden
assert.match(ask("Should we invest in stocks?"), /never pick/);
assert.match(ask("Can we afford a 4.000 kr bike?"), /4,000 kr fits/);
assert.match(ask("How much can we save for the trip?"), /8,800 kr to go/);
assert.match(ask("Where did our money go this month?"), /food: 313 kr of 6,500 kr/);

// Oct 21: no Sept receipts -> project Oct food 312.5 to 31 days = 461 * 1.05 -> 500
const s = suggestBudgets([{ date: "2026-10-18T17:42:00+02:00", category: "food", total: 312.5 }],
  { income: 52000, budgets }, ctx.goal, new Date(2026, 9, 21));
assert.equal(s.food, 500);
assert.equal(s.home, 3000);
console.log("advisor self-check OK");
