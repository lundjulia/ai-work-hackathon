import assert from "node:assert/strict";
import { test } from "node:test";
import { createLocalDemoStore } from "./local-demo-store";
import { createInitialDemoState } from "./demo-initial";
import { applyLocalDemoOperation } from "./demo-operations";
import { DEMO_STORAGE_KEY } from "./state-events";

function memory() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}
function mutex() {
  let queue: Promise<unknown> = Promise.resolve();
  return <T>(work: () => Promise<T>): Promise<T> => {
    const result = queue.then(work);
    queue = result.catch(() => {});
    return result;
  };
}
test("local initialization survives a new store, no-op saves keep the revision", async () => {
  const storage = memory();
  const events: number[] = [];
  const store = createLocalDemoStore({ storage, notify: (revision) => events.push(revision) });
  const first = await store.read();
  assert.equal(first.revision, 0);
  const updated = await store.mutate((state) => applyLocalDemoOperation(state, { operation: "connectBank", bankId: "danske" }));
  assert.equal(updated.revision, 1);
  assert.deepEqual((await createLocalDemoStore({ storage }).read()).state.connectedBanks, ["danske"]);
  assert.equal((await store.mutate((state) => state)).revision, 1);
  assert.deepEqual(events, [0, 1]);
});

test("a shared browser lock preserves concurrent tab updates and exactly-once CAS", async () => {
  const storage = memory();
  const lock = mutex();
  const first = createLocalDemoStore({ storage, lock, writerId: "one" });
  const second = createLocalDemoStore({ storage, lock, writerId: "two" });
  await first.read();
  await Promise.all([
    first.mutate((state) => applyLocalDemoOperation(state, { operation: "connectBank", bankId: "danske" })),
    second.mutate((state) => applyLocalDemoOperation(state, { operation: "connectBank", bankId: "revolut" })),
  ]);
  const before = await first.read();
  assert.deepEqual(before.state.connectedBanks, ["danske", "revolut"]);
  assert.equal(before.revision, 2);
  const result = await Promise.all([
    first.compareAndSwap(before.revision, { ...before.state, onboarded: true }),
    second.compareAndSwap(before.revision, { ...before.state, simulatedDate: "2026-10-20" }),
  ]);
  assert.equal(result.filter(Boolean).length, 1);
  assert.equal((await second.read()).revision, 3);
});

test("slow work retries after a newer tab write when Web Locks are absent", async () => {
  const storage = memory();
  const first = createLocalDemoStore({ storage });
  const second = createLocalDemoStore({ storage });
  await first.read();
  let calls = 0;
  await first.mutate(async (state) => {
    if (++calls === 1) await second.mutate((latest) => ({ ...latest, onboarded: true }));
    return { ...state, simulatedDate: "2026-10-20" };
  });
  const current = await first.read();
  assert.equal(current.state.onboarded, true);
  assert.equal(current.state.simulatedDate, "2026-10-20");
  assert.equal(calls, 2);
});

test("AI response from before another save cannot overwrite its goals or approvals", async () => {
  const store = createLocalDemoStore({ storage: memory() });
  const before = await store.read();
  await store.mutate((state) => ({ ...state, goals: { ...state.goals, monthlyIncome: 61_000 }, goalsRevision: state.goalsRevision + 1 }));
  assert.equal(await store.compareAndSwap(before.revision, { ...before.state, onboarded: true }), false);
  assert.equal((await store.read()).state.goals.monthlyIncome, 61_000);
});

test("bad or unavailable storage is reported, preserving saved bytes", async () => {
  const storage = memory();
  storage.setItem(DEMO_STORAGE_KEY, "bad json");
  await assert.rejects(createLocalDemoStore({ storage }).read(), { code: "local_state_invalid" });
  assert.equal(storage.getItem(DEMO_STORAGE_KEY), "bad json");
  const unavailable = createLocalDemoStore({ storage: { getItem: () => null, setItem: () => { throw new Error("quota"); } } });
  await assert.rejects(unavailable.read(), { code: "local_storage_unavailable" });
});

test("invalid output and failed operations do not save, reset advances revision", async () => {
  const store = createLocalDemoStore({ storage: memory() });
  const before = await store.read();
  await assert.rejects(store.mutate((state) => ({ ...state, simulatedDate: "2026-02-30" })));
  await assert.rejects(store.mutate((state) => applyLocalDemoOperation(state, { operation: "decide", id: "absent", decision: "approved" })), { code: "action_not_found" });
  assert.deepEqual(await store.read(), before);
  const reset = await store.mutate((state) => applyLocalDemoOperation(state, { operation: "reset" }));
  assert.equal(reset.revision, 1);
  assert.equal(reset.state.goalsRevision, 1);
  assert.equal(await store.compareAndSwap(before.revision, await createInitialDemoState()), false);
});
