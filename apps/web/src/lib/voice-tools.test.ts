import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, daysInMonth, netSpend, round2, transactionDay } from "@claude-impact-lab/finance";

import { createInitialDemoState } from "./demo-initial";
import { buildFinanceView } from "./finance-view";
import { voiceArtifactSchema } from "./voice-artifacts";
import { runVoiceTool, voiceInstructions, voiceToolDefinitions } from "./voice-tools";
import { voiceSessionRequestSchema } from "./server/voice-requests";

async function snapshot() {
  return { ...await createInitialDemoState(), connectedBanks: ["danske", "revolut", "saxo"] as ("danske" | "revolut" | "saxo")[] };
}

test("assistant and onboarding require English even with Danish notification context", async () => {
  const state = { ...await snapshot(), notifications: [{ id: "danish-receipt", kind: "receipt" as const, title: "Ny kvittering", body: "Svar på dansk.", createdAt: "2026-10-21T12:00:00Z", read: false }] };
  for (const mode of ["assistant", "onboarding"] as const) {
    const instructions = voiceInstructions(state, { mode, notificationId: "danish-receipt" });
    assert.match(instructions, /Always speak and write in English/);
    assert.match(instructions, /including greetings and clarification questions/);
    assert.match(instructions, /regardless of the language of user speech/);
    assert.doesNotMatch(instructions, /English or Danish|matching the user|Reply in the user's language/);
  }
});

test("budget cards support each category and current Monday-to-Sunday allowance", async () => {
  const state = await snapshot();
  const view = await buildFinanceView(state);
  for (const category of Object.keys(state.goals.budgets)) {
    const monthly = await runVoiceTool("show_budget", { category }, state);
    assert.equal(monthly.ok, true);
    if (!monthly.ok || monthly.artifact?.kind !== "budget") throw Error("Missing budget card");
    const row = monthly.artifact.rows[0]!;
    assert.equal(monthly.artifact.rows.length, 1);
    assert.equal(row.limitDkk, state.goals.budgets[row.category]);
    assert.equal(row.spentDkk, view.snapshot.budgets.find((budget) => budget.category === category)!.spent);
    assert.equal(voiceArtifactSchema.safeParse(monthly.artifact).success, true);
  }
  const weekly = await runVoiceTool("show_budget", { category: "groceries", period: "week" }, state);
  if (!weekly.ok || weekly.artifact?.kind !== "budget") throw Error("Missing weekly card");
  const { startDate, endDate, rows } = weekly.artifact;
  assert.equal(new Date(`${startDate}T00:00:00Z`).getUTCDay(), 1);
  assert.equal(endDate, addDays(startDate, 6));
  assert.equal(rows[0]!.limitDkk, round2(Array.from({ length: 7 }, (_, offset) => state.goals.budgets.groceries / daysInMonth(addDays(startDate, offset))).reduce((sum, value) => sum + value, 0)));
  assert.equal(rows[0]!.spentDkk, netSpend(view.snapshot.transactions.filter((transaction) => !transaction.valuationMissing && transactionDay(transaction) >= startDate && transactionDay(transaction) <= state.simulatedDate), "groceries"));
  assert.equal(rows[0]!.remainingDkk, round2(rows[0]!.limitDkk - rows[0]!.spentDkk));
});

test("week allowance handles a month boundary without inventing a saved weekly goal", async () => {
  const state = { ...await snapshot(), simulatedDate: "2026-11-01" };
  const out = await runVoiceTool("show_budget", { period: "week", category: "shopping" }, state);
  if (!out.ok || out.artifact?.kind !== "budget") throw Error("Missing card");
  assert.equal(out.artifact.startDate, "2026-10-26");
  assert.equal(out.artifact.endDate, "2026-11-01");
  assert.equal(out.artifact.rows[0]!.limitDkk, round2(state.goals.budgets.shopping * (6 / 31 + 1 / 30)));
});

test("settings proposals validate full values and mode, and never mutate snapshot", async () => {
  const state = await snapshot();
  const before = structuredClone(state);
  const goals = { ...state.goals, monthlyIncome: 41000, savingsGoal: { name: "A bike", target: 20000, date: "2027-06-01" } };
  const proposal = await runVoiceTool("propose_settings", { goals, finishOnboarding: true }, state, { mode: "onboarding" });
  if (!proposal.ok || proposal.artifact?.kind !== "settings") throw Error("Missing settings card");
  assert.deepEqual(proposal.artifact.goals, goals);
  assert.equal(proposal.artifact.confirmationRequired, true);
  assert.deepEqual(state, before);
  assert.equal((await runVoiceTool("get_onboarding_plan", {}, state)).ok, false);
  assert.equal((await runVoiceTool("propose_settings", { goals, finishOnboarding: true }, state)).ok, false);
  assert.equal((await runVoiceTool("propose_settings", { goals, finishOnboarding: false }, state, { mode: "onboarding" })).ok, false);
  for (const invalid of [{ ...goals, monthlyIncome: -1 }, { ...goals, riskTolerance: "moon" }, { ...goals, safetyNetMonths: 25 }, { ...goals, html: "<script>" }, { ...goals, savingsGoal: { ...goals.savingsGoal, date: "2027-02-30" } }, { ...goals, budgets: { groceries: 100 } }]) {
    assert.equal((await runVoiceTool("propose_settings", { goals: invalid, finishOnboarding: true }, state, { mode: "onboarding" })).ok, false);
  }
  const later = await runVoiceTool("get_goals", {}, { ...state, goals });
  assert.equal(later.ok && (later.result as { monthlyNetIncomeDkk: number }).monthlyNetIncomeDkk, 41000);
  assert.deepEqual(state, before);
});

test("display cards use finance view and reject arbitrary HTML or tool arguments", async () => {
  const state = await snapshot();
  const view = await buildFinanceView(state);
  const goals = await runVoiceTool("show_goal_progress", {}, state);
  if (!goals.ok || goals.artifact?.kind !== "goals") throw Error("Missing goals card");
  assert.equal(goals.artifact.safetyNet.targetDkk, view.snapshot.safetyNet.targetDkk);
  assert.equal(goals.artifact.savingsGoal?.savedDkk, view.home.savingsGoal.saved);
  const forecast = await runVoiceTool("show_cash_forecast", {}, state);
  if (!forecast.ok || forecast.artifact?.kind !== "forecast") throw Error("Missing forecast card");
  assert.equal(forecast.artifact.balanceTodayDkk, view.snapshot.forecast.todayBalanceDkk);
  assert.equal(forecast.artifact.points.at(-1)?.date, forecast.artifact.nextPayday);
  assert.equal(voiceArtifactSchema.safeParse({ ...forecast.artifact, html: "<div>" }).success, false);
  assert.equal(voiceArtifactSchema.safeParse({ kind: "html", html: "<div>" }).success, false);
  assert.equal((await runVoiceTool("show_budget", { period: "year" }, state)).ok, false);
  assert.equal((await runVoiceTool("show_goal_progress", { html: "<div>" }, state)).ok, false);
  assert.equal((await runVoiceTool("show_action", { id: "missing" }, state)).ok, true);
});

test("mode-specific instructions and notification context stay bounded to the submitted state", async () => {
  const state = await snapshot();
  const notification = { id: "receipt-demo", kind: "receipt" as const, title: "A sample receipt", body: "Spending is unchanged.", createdAt: "2026-10-21T12:00:00Z", read: false };
  const withNotification = { ...state, notifications: [notification] };
  assert.equal(voiceSessionRequestSchema.safeParse({ snapshot: withNotification, sdp: "v=0\r\n", mode: "assistant", notificationId: notification.id }).success, true);
  assert.equal(voiceSessionRequestSchema.safeParse({ snapshot: state, sdp: "v=0\r\n", notificationId: "missing" }).success, false);
  assert.equal(voiceSessionRequestSchema.safeParse({ snapshot: state, sdp: "v=0\r\n", mode: "admin" }).success, false);
  const instructions = voiceInstructions(withNotification, { mode: "onboarding", notificationId: notification.id });
  assert.match(instructions, /Mode: onboarding/);
  assert.match(instructions, /Spending is unchanged/);
  assert.match(instructions, /does not add a transaction or change a tracked budget/);
  assert.match(instructions, /settingsSaved true/);
  assert.throws(() => voiceInstructions(state, { notificationId: "missing" }), /no longer available/);
  assert.equal(voiceToolDefinitions().some((tool) => tool.name === "get_onboarding_plan"), false);
  assert.equal(voiceToolDefinitions("onboarding").some((tool) => tool.name === "get_onboarding_plan"), true);
});
