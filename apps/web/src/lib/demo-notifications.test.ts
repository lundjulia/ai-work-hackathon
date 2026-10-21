import assert from "node:assert/strict";
import { test } from "node:test";
import { createInitialDemoState } from "./demo-initial";
import { persistedDemoStateSchema } from "./demo-state-schema";
import { applyLocalDemoOperation } from "./demo-operations";
import { createLocalDemoStore } from "./local-demo-store";
import { DEMO_STORAGE_KEY } from "./state-events";
import { notificationLink } from "./demo-notifications";

test("existing browser records gain notification defaults without losing saved settings", async () => {
  const state = await createInitialDemoState();
  delete state.notifications;
  delete state.nexiConnected;
  state.goals.monthlyIncome = 41_250;
  const raw = JSON.stringify({ storageVersion: 1, state, revision: 8, writerId: "old-tab" });
  const store = createLocalDemoStore({ storage: { getItem: (key) => key === DEMO_STORAGE_KEY ? raw : null, setItem: () => {} } });
  const record = await store.read();
  assert.equal(record.revision, 8);
  assert.equal(record.state.goals.monthlyIncome, 41_250);
  assert.deepEqual(record.state.notifications, []);
  assert.equal(record.state.nexiConnected, false);
});

test("simulated Nexi event requires connection, persists an update and never changes money", async () => {
  const initial = await createInitialDemoState();
  await assert.rejects(applyLocalDemoOperation(initial, { operation: "triggerEvent", kind: "receipt" }), /Connect the Nexi/);
  const connected = await applyLocalDemoOperation(initial, { operation: "connectNexi" });
  const next = await applyLocalDemoOperation(connected, { operation: "triggerEvent", kind: "receipt" });
  const item = next.notifications![0]!;
  assert.equal(item.kind, "receipt");
  assert.match(item.body, /spending has not changed/);
  assert.deepEqual(next.goals, initial.goals);
  assert.deepEqual(next.adjustments, initial.adjustments);
  assert.deepEqual(next.actions, initial.actions);
  assert.equal(next.goalsRevision, initial.goalsRevision);
  const read = await applyLocalDemoOperation(next, { operation: "readNotification", id: item.id });
  assert.equal(read.notifications![0]!.read, true);
  assert.equal(notificationLink(item.id), `/?notification=${item.id}&start=1`);
  assert.equal(persistedDemoStateSchema.safeParse({ ...read, notifications: [item, item] }).success, false);
});

test("confirmed onboarding persists the same goals subsequent agents read, with stale saves rejected", async () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const store = createLocalDemoStore({ storage });
  await store.mutate((state) => applyLocalDemoOperation(state, { operation: "connectBank", bankId: "danske" }));
  const before = await store.read();
  const goals = { ...before.state.goals, monthlyIncome: 39_500, safetyNetMonths: 4, savingsGoal: { name: "Family holiday", target: 21_000, date: "2027-07-01" }, budgets: { ...before.state.goals.budgets, groceries: 4_100 } };
  const proposed = await applyLocalDemoOperation(before.state, { operation: "completeOnboarding", goals });
  assert.equal((await store.read()).state.onboarded, false);
  assert.equal(await store.compareAndSwap(before.revision, proposed), true);
  assert.equal(await store.compareAndSwap(before.revision, { ...proposed, goals: before.state.goals }), false);
  const reloaded = await createLocalDemoStore({ storage }).read();
  assert.equal(reloaded.state.onboarded, true);
  assert.deepEqual(reloaded.state.goals, goals);
});
