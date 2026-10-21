import assert from "node:assert/strict";
import { test } from "node:test";
import { ACCOUNT_IDS } from "@claude-impact-lab/finance";

import { createInitialDemoState } from "../demo-initial";
import { applyLocalDemoOperation } from "../demo-operations";
import { demoOperationSchema } from "../demo-operation-schema";
import { persistedDemoStateSchema, autopilotSnapshotRequestSchema } from "../demo-state-schema";
import type { PersistedDemoState } from "../demo-state-schema";
import { buildFinanceView } from "../finance-view";
import { runAutopilotSnapshot, reviewResultSchema, candidateSuppressed, selectDailyCandidates, autopilotConfigured } from "./autopilot";
import { readBoundedJson } from "./demo-http";

type Selector = NonNullable<Parameters<typeof runAutopilotSnapshot>[1]>;
const chooseTransfer: Selector = async ({ candidates }) => ({ candidateKeys: [candidates.find((candidate) => candidate.type === "transfer_suggestion")!.key, ...candidates.filter((candidate) => candidate.severity === "high").slice(0, 1).map((candidate) => candidate.key)], summary: "Computed findings and a savings opportunity need attention." });

test("Haiku review omits unsupported temperature and preserves forced tool output", { skip: !autopilotConfigured() }, async (context) => {
  let requestBody: Record<string, unknown> | undefined;
  context.mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
    requestBody = JSON.parse(String(init.body));
    return Response.json({ content: [{ type: "tool_use", name: "submit_daily_review", input: { candidateKeys: [], summary: "No relevant findings need attention in this simulated review." } }] });
  });
  const view = await buildFinanceView(await createInitialDemoState());
  const result = await selectDailyCandidates({ date: "2026-10-19", goals: view.domainGoals, candidates: [] });
  assert.ok(requestBody);
  assert.equal(requestBody.model, "claude-haiku-5-5");
  assert.equal("temperature" in requestBody, false);
  assert.deepEqual(requestBody.tool_choice, { type: "tool", name: "submit_daily_review" });
  assert.deepEqual(result.candidateKeys, []);
});
async function transferSnapshot() {
  const state: PersistedDemoState = { ...await createInitialDemoState(), simulatedDate: "2026-10-30", connectedBanks: ["danske", "revolut", "saxo"] };
  return runAutopilotSnapshot(state, chooseTransfer);
}

test("client onboarding and clock transitions need no database or network", async () => {
  let state = await createInitialDemoState();
  state = await applyLocalDemoOperation(state, { operation: "connectBank", bankId: "danske" });
  state = await applyLocalDemoOperation(state, { operation: "completeOnboarding", goals: state.goals });
  assert.equal(state.onboarded, true);
  assert.equal(state.runs.length, 0);
  await assert.rejects(applyLocalDemoOperation(state, { operation: "runAutopilot" }), { code: "server_review_required" });
  state = await applyLocalDemoOperation(state, { operation: "advanceDays", days: 14 });
  assert.equal(state.simulatedDate, "2026-11-02");
  await assert.rejects(applyLocalDemoOperation(state, { operation: "advanceDays", days: 1 }), { code: "clock_out_of_range" });
});

test("snapshot and operation schemas reject unknown, nonfinite and out-of-range data", async () => {
  const state = await createInitialDemoState();
  const invalid = [
    { ...state, simulatedDate: "2026-10-35" }, { ...state, simulatedDate: "2026-12-01" },
    { ...state, connectedBanks: ["danske", "danske"] }, { ...state, connectedBanks: ["unknown"] },
    { ...state, candidates: [] }, { ...state, adjustments: { forged: 100 } },
    { ...state, goals: { ...state.goals, monthlyIncome: Infinity } },
    { ...state, goalsRevision: -1 }, { ...state, runs: Array(101).fill({}) },
  ];
  for (const snapshot of invalid) assert.equal(persistedDemoStateSchema.safeParse(snapshot).success, false);
  assert.equal(autopilotSnapshotRequestSchema.safeParse({ snapshot: state, operation: "runAutopilot", candidates: [] }).success, false);
  assert.equal(demoOperationSchema.safeParse({ operation: "decide", id: "a", decision: "approved", amount: 100 }).success, false);
  assert.equal(reviewResultSchema.safeParse({ candidateKeys: ["a", "a"], summary: "Needs attention." }).success, false);
  assert.equal(reviewResultSchema.safeParse({ candidateKeys: [], summary: "Save DKK 100." }).success, false);
});

test("snapshot envelope rejects streamed bytes over its limit", async () => {
  const body = " ".repeat(262145);
  const result = await readBoundedJson(new Request("https://demo.example", { method: "POST", body }), 262144);
  assert.deepEqual(result, { ok: false, error: "Body too large", status: 413 });
});

test("stateless daily run is idempotent against the supplied snapshot", async () => {
  const initial: PersistedDemoState = { ...await createInitialDemoState(), connectedBanks: ["danske", "revolut", "saxo"] };
  let calls = 0;
  const select: Selector = async ({ candidates }) => {
    calls++;
    return { candidateKeys: candidates.slice().sort((a, b) => Number(b.severity === "high") - Number(a.severity === "high")).slice(0, 3).map((candidate) => candidate.key), summary: "Some computed findings need attention in this simulated review." };
  };
  const first = await runAutopilotSnapshot(initial, select);
  const second = await runAutopilotSnapshot(first.state, select);
  assert.equal(calls, 1);
  assert.equal(second.run.id, first.run.id);
  assert.equal(second.items.length, 0);
  assert.equal(initial.actions.length, 0);
});

test("selector cannot invent candidates or numeric summaries", async () => {
  const state: PersistedDemoState = { ...await createInitialDemoState(), connectedBanks: ["danske"] };
  await assert.rejects(runAutopilotSnapshot(state, async () => ({ candidateKeys: ["forged"], summary: "Something needs attention." })), { code: "autopilot_invalid_review" });
  await assert.rejects(runAutopilotSnapshot(state, async () => ({ candidateKeys: [], summary: "Save 100 DKK." })), { code: "autopilot_invalid_review" });
  assert.equal(state.runs.length, 0);
});

test("stateless review rejects omission of urgent computed findings", async () => {
  const initial: PersistedDemoState = { ...await createInitialDemoState(), simulatedDate: "2026-10-29", connectedBanks: ["danske", "revolut", "saxo"] };
  assert.ok((await buildFinanceView(initial)).candidates.some((candidate) => candidate.severity === "high"));
  await assert.rejects(runAutopilotSnapshot(initial, async () => ({ candidateKeys: [], summary: "No relevant findings need attention." })), { code: "autopilot_invalid_review" });
});

test("review output copies immutable computed money and evidence", async () => {
  const result = await transferSnapshot();
  const item = result.items[0]!;
  const view = await buildFinanceView({ ...result.state, actions: [], runs: [] });
  const candidate = view.candidates.find((candidate) => candidate.key === item.candidateKey)!;
  assert.equal(item.amount!.amount, candidate.amount);
  assert.equal(item.title, candidate.title);
  assert.equal(item.body, candidate.body);
  assert.deepEqual(item.facts, candidate.facts);
});

test("transfer approval moves balances once and duplicate approval rejects", async () => {
  const result = await transferSnapshot();
  const item = result.items[0]!;
  const before = await buildFinanceView(result.state);
  const approved = await applyLocalDemoOperation(result.state, { operation: "decide", id: item.id, decision: "approved" });
  assert.equal(approved.adjustments[ACCOUNT_IDS.danskeEveryday], -item.amount!.amount);
  assert.equal(approved.adjustments[ACCOUNT_IDS.danskeSavings], item.amount!.amount);
  assert.equal((await buildFinanceView(approved)).home.total.totalDkk, before.home.total.totalDkk);
  await assert.rejects(applyLocalDemoOperation(approved, { operation: "decide", id: item.id, decision: "approved" }), { code: "action_already_decided" });
  await assert.rejects(applyLocalDemoOperation(approved, { operation: "reopen", id: item.id }), { code: "action_not_dismissed" });
});

test("stale transfer rejects without moving funds, dismissed stale proposal may be revised", async () => {
  const result = await transferSnapshot();
  let changed = await applyLocalDemoOperation(result.state, { operation: "saveGoals", goals: { ...result.state.goals, safetyNetMonths: 5 } });
  await assert.rejects(applyLocalDemoOperation(changed, { operation: "decide", id: result.items[0]!.id, decision: "approved" }), { code: "stale_transfer" });
  assert.deepEqual(changed.adjustments, {});
  changed = await applyLocalDemoOperation(changed, { operation: "decide", id: result.items[0]!.id, decision: "dismissed" });
  const revised = await runAutopilotSnapshot(changed, chooseTransfer);
  assert.equal(revised.items.filter((item) => item.type === "transfer").length, 1);
});

test("forged transfer evidence and amounts cannot be approved", async () => {
  const result = await transferSnapshot();
  const item = result.items[0]!;
  const modified = [
    { ...item, amount: { amount: item.amount!.amount + 100, currency: "DKK" as const } },
    { ...item, title: "Move arbitrary funds" }, { ...item, runId: "missing-review" },
    { ...item, amount: { amount: -100, currency: "DKK" as const } },
  ];
  for (const action of modified) {
    const snapshot = { ...result.state, actions: [action] };
    await assert.rejects(applyLocalDemoOperation(snapshot, { operation: "decide", id: action.id, decision: "approved" }));
    assert.deepEqual(snapshot.adjustments, {});
  }
});

test("not-useful feedback suppresses changed evidence in later months", async () => {
  const state = await createInitialDemoState();
  state.actions = [{ id: "feedback", runId: "run", type: "budget_alert", title: "Budget", body: "Budget", severity: "warning", status: "dismissed", rationale: "Computed", createdAt: "2026-10-21T00:00:00Z", candidateKey: "budget:2026-10:restaurants:near", facts: { category: "restaurants" }, feedback: "not_useful" }];
  const candidate = { key: "budget:2026-11:restaurants:over", type: "budget_alert" as const, title: "Budget", body: "Budget", severity: "high" as const, rationale: "Computed", triggeredOn: "2026-11-01", facts: { category: "restaurants" } };
  assert.equal(candidateSuppressed(candidate, state), true);
});
