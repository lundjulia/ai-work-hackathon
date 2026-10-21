import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createClient } from "@libsql/client";
import { ACCOUNT_IDS } from "@claude-impact-lab/finance";

import { ENV } from "../../env.server";
import { buildFinanceView } from "../finance-view";
import { runAutopilot, reviewResultSchema, candidateSuppressed } from "./autopilot";
import { createInitialDemoState } from "./demo-initial";
import { demoOperationSchema } from "./demo-requests";
import { applyDemoOperation } from "./demo-service";
import { createDemoStore, DEMO_STATE_TABLE } from "./demo-store";
import type { PersistedDemoState } from "./demo-store";

const remote = process.env.DEMO_TEST_TURSO === "1";
if (remote && !/^(libsql|https):\/\//.test(ENV.DATABASE_URL)) {
  throw new Error("DEMO_TEST_TURSO requires an actual remote Turso URL, not scaffold file defaults.");
}
const client = createClient(remote ? { url: ENV.DATABASE_URL, authToken: ENV.DATABASE_AUTH_TOKEN } : { url: "file::memory:" });
const ids: string[] = [];
function store(initial?: () => Promise<PersistedDemoState>) {
  const id = `verify-${crypto.randomUUID()}`;
  ids.push(id);
  return createDemoStore(client, id, initial ?? createInitialDemoState);
}
after(async () => {
  for (const id of ids) await client.execute({ sql: `DELETE FROM ${DEMO_STATE_TABLE} WHERE id = ?`, args: [id] });
  client.close();
});

test("two clients cannot overwrite the same database revision", async () => {
  const db = store();
  const before = await db.read();
  const results = await Promise.all([
    db.compareAndSwap(before.revision, { ...before.state, onboarded: true }),
    db.compareAndSwap(before.revision, { ...before.state, simulatedDate: "2026-10-21" }),
  ]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal((await db.read()).revision, before.revision + 1);
  const resumed = createDemoStore(client, ids.at(-1)!);
  assert.deepEqual(await resumed.read(), await db.read());
});

test("concurrent mutations preserve each update", async () => {
  const db = store();
  await Promise.all(Array.from({ length: 6 }, () => db.mutate((state) => ({ ...state, goalsRevision: state.goalsRevision + 1 }))));
  assert.equal((await db.read()).state.goalsRevision, 6);
});

test("request schema rejects invalid amounts, fields and calendar dates", () => {
  assert.equal(demoOperationSchema.safeParse({ operation: "advanceDays", days: -1 }).success, false);
  assert.equal(demoOperationSchema.safeParse({ operation: "decide", id: "a", decision: "approved", amount: 100 }).success, false);
  assert.equal(reviewResultSchema.safeParse({ candidateKeys: ["a", "a"], summary: "Needs attention." }).success, false);
  assert.equal(reviewResultSchema.safeParse({ candidateKeys: [], summary: "Save DKK 100." }).success, false);
});

test("onboarding persists without a Claude key, clock stays within fixtures", { skip: Boolean(ENV.ANTHROPIC_API_KEY) }, async () => {
  const db = store();
  const initial = await createInitialDemoState();
  await applyDemoOperation({ operation: "connectBank", bankId: "danske" }, db);
  const response = await applyDemoOperation({ operation: "completeOnboarding", goals: initial.goals }, db);
  assert.equal(response.state.onboarded, true);
  if (!ENV.ANTHROPIC_API_KEY) {
    assert.equal(response.configured.autopilot, false);
    assert.equal(response.run, undefined);
    assert.match(response.message!, /Claude API key/);
    await assert.rejects(runAutopilot(db), { code: "autopilot_not_configured" });
  }
  await applyDemoOperation({ operation: "advanceDays", days: 14 }, db);
  await assert.rejects(applyDemoOperation({ operation: "advanceDays", days: 1 }, db), { code: "clock_out_of_range" });
  assert.equal((await db.read()).state.simulatedDate, "2026-11-02");
});

test("not-useful feedback suppresses changed budget evidence in later months", async () => {
  const state = await createInitialDemoState();
  state.actions = [{ id: "feedback", runId: "run", type: "budget_alert", title: "Budget", body: "Budget", severity: "warning", status: "dismissed", rationale: "Computed", createdAt: "2026-10-21T00:00:00Z", candidateKey: "budget:2026-10:restaurants:near", facts: { category: "restaurants" }, feedback: "not_useful" }];
  const candidate = { key: "budget:2026-11:restaurants:over", type: "budget_alert" as const, title: "Budget", body: "Budget", severity: "high" as const, rationale: "Computed", triggeredOn: "2026-11-01", facts: { category: "restaurants" } };
  assert.equal(candidateSuppressed(candidate, state), true);
});

test("daily runs are idempotent and feedback suppresses later repeats", async () => {
  const db = store(async () => ({ ...await createInitialDemoState(), connectedBanks: ["danske", "revolut", "saxo"] }));
  let calls = 0;
  const selector: Parameters<typeof runAutopilot>[1] = async (input) => {
    calls++;
    return { candidateKeys: input.candidates.slice(0, 3).map((candidate) => candidate.key), summary: "Some computed findings need attention in this simulated review." };
  };
  const first = await runAutopilot(db, selector);
  assert.ok(first.items.length > 0);
  const repeated = await runAutopilot(db, selector);
  assert.equal(first.run.id, repeated.run.id);
  assert.equal(calls, 1);
  assert.equal(repeated.items.length, 0);
  await applyDemoOperation({ operation: "markNotUseful", id: first.items[0]!.id }, db);
  await applyDemoOperation({ operation: "advanceDays", days: 1 }, db);
  const later = await runAutopilot(db, selector);
  assert.equal(later.items.some((item) => first.items.some((old) => old.candidateKey === item.candidateKey)), false);
});

test("an in-flight review cannot overwrite a changed clock", async () => {
  const db = store(async () => ({ ...await createInitialDemoState(), connectedBanks: ["danske"] }));
  await assert.rejects(runAutopilot(db, async () => {
    await db.mutate((state) => ({ ...state, simulatedDate: "2026-10-21" }));
    return { candidateKeys: [], summary: "No relevant findings need attention." };
  }), { code: "review_state_changed" });
  const state = (await db.read()).state;
  assert.equal(state.simulatedDate, "2026-10-21");
  assert.equal(state.runs.length, 0);
});

test("transfer approval moves balances once under concurrent requests", async () => {
  const db = store(async () => ({ ...await createInitialDemoState(), simulatedDate: "2026-10-30", connectedBanks: ["danske", "revolut", "saxo"] }));
  const result = await runAutopilot(db, async ({ candidates }) => {
    const candidate = candidates.find((item) => item.type === "transfer_suggestion");
    assert.ok(candidate, "Expected a computed surplus transfer on salary day.");
    return { candidateKeys: [candidate.key], summary: "A computed surplus can support your savings goal." };
  });
  const item = result.items[0]!;
  const before = await buildFinanceView(result.state);
  const outcomes = await Promise.allSettled([
    applyDemoOperation({ operation: "decide", id: item.id, decision: "approved" }, db),
    applyDemoOperation({ operation: "decide", id: item.id, decision: "approved" }, db),
  ]);
  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
  const state = (await db.read()).state;
  assert.equal(state.adjustments[ACCOUNT_IDS.danskeEveryday], -item.amount!.amount);
  assert.equal(state.adjustments[ACCOUNT_IDS.danskeSavings], item.amount!.amount);
  const after = await buildFinanceView(state);
  assert.equal(after.home.total.totalDkk, before.home.total.totalDkk);
  await assert.rejects(applyDemoOperation({ operation: "reopen", id: item.id }, db), { code: "action_not_dismissed" });
});

test("changed goals reject a stale transfer without moving funds", async () => {
  const db = store(async () => ({ ...await createInitialDemoState(), simulatedDate: "2026-10-30", connectedBanks: ["danske", "revolut", "saxo"] }));
  const result = await runAutopilot(db, async ({ candidates }) => ({ candidateKeys: [candidates.find((candidate) => candidate.type === "transfer_suggestion")!.key], summary: "A computed surplus can support your savings goal." }));
  const state = (await db.read()).state;
  await applyDemoOperation({ operation: "saveGoals", goals: { ...state.goals, safetyNetMonths: 5 } }, db);
  await assert.rejects(applyDemoOperation({ operation: "decide", id: result.items[0]!.id, decision: "approved" }, db), { code: "stale_transfer" });
  assert.deepEqual((await db.read()).state.adjustments, {});
});

test("dismissed stale transfer can be proposed again after a goal revision", async () => {
  const db = store(async () => ({ ...await createInitialDemoState(), simulatedDate: "2026-10-30", connectedBanks: ["danske", "revolut", "saxo"] }));
  const chooseTransfer: Parameters<typeof runAutopilot>[1] = async ({ candidates }) => ({ candidateKeys: [candidates.find((candidate) => candidate.type === "transfer_suggestion")!.key], summary: "A computed surplus can support your savings goal." });
  const result = await runAutopilot(db, chooseTransfer);
  await applyDemoOperation({ operation: "saveGoals", goals: { ...result.state.goals, safetyNetMonths: 5 } }, db);
  await applyDemoOperation({ operation: "decide", id: result.items[0]!.id, decision: "dismissed" }, db);
  const revised = await runAutopilot(db, chooseTransfer);
  assert.equal(revised.items.length, 1);
  assert.equal(revised.items[0]!.goalRevision, 1);
});

test("negative transfer proposals never change balances", async () => {
  const db = store(async () => ({ ...await createInitialDemoState(), simulatedDate: "2026-10-30", connectedBanks: ["danske", "revolut", "saxo"] }));
  const result = await runAutopilot(db, async ({ candidates }) => ({ candidateKeys: [candidates.find((candidate) => candidate.type === "transfer_suggestion")!.key], summary: "A computed surplus can support your savings goal." }));
  await db.mutate((state) => ({ ...state, actions: state.actions.map((item) => ({ ...item, amount: { amount: -100, currency: "DKK" } })) }));
  await assert.rejects(applyDemoOperation({ operation: "decide", id: result.items[0]!.id, decision: "approved" }, db), { code: "invalid_transfer" });
  assert.deepEqual((await db.read()).state.adjustments, {});
});
