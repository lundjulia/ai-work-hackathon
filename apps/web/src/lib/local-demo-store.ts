import { DemoError } from "./demo-errors";
import { createInitialDemoState } from "./demo-initial";
import { DEMO_SNAPSHOT_MAX_BYTES, persistedDemoStateSchema, type PersistedDemoState } from "./demo-state-schema";
import { DEMO_STORAGE_KEY, publishStateChange } from "./state-events";

export type LocalDemoRecord = { storageVersion: 1; state: PersistedDemoState; revision: number; writerId: string };
type StoreOptions = {
  storage: Pick<Storage, "getItem" | "setItem">;
  initialize?: () => Promise<PersistedDemoState>;
  lock?: <T>(work: () => Promise<T>) => Promise<T>;
  notify?: (revision: number) => void;
  writerId?: string;
};
const conflict = () => new DemoError("state_conflict", "Your demo changed while this result was being prepared. Try again.", 409);

/** Browser-owned demo state. No lock is held while waiting for an AI response. */
export function createLocalDemoStore({
  storage, initialize = createInitialDemoState, lock, notify = () => {}, writerId = crypto.randomUUID(),
}: StoreOptions) {
  let queue: Promise<unknown> = Promise.resolve();
  function exclusive<T>(work: () => Promise<T>): Promise<T> {
    const result = queue.then(() => lock ? lock(work) : work());
    queue = result.catch(() => {});
    return result;
  }
  function stored(): LocalDemoRecord | undefined {
    let raw: string | null;
    try { raw = storage.getItem(DEMO_STORAGE_KEY); }
    catch { throw new DemoError("local_storage_unavailable", "Browser storage is unavailable. Enable site storage and try again.", 503); }
    if (raw === null) return;
    try {
      if (new TextEncoder().encode(raw).length > DEMO_SNAPSHOT_MAX_BYTES + 1_024) throw new Error("Oversized record");
      const value = JSON.parse(raw) as Partial<LocalDemoRecord>;
      if (value.storageVersion !== 1 || !Number.isSafeInteger(value.revision) || value.revision! < 0 || typeof value.writerId !== "string") throw new Error("Invalid record");
      return { storageVersion: 1, state: persistedDemoStateSchema.parse(value.state), revision: value.revision!, writerId: value.writerId };
    } catch {
      throw new DemoError("local_state_invalid", "Saved demo data is invalid. Clear this site's demo storage to start again.", 409);
    }
  }
  function save(record: LocalDemoRecord) {
    if (new TextEncoder().encode(JSON.stringify(record.state)).length > DEMO_SNAPSHOT_MAX_BYTES - 1_024) {
      throw new DemoError("local_state_full", "The demo history is full. Reset the demo before continuing.", 413);
    }
    try { storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(record)); }
    catch { throw new DemoError("local_storage_unavailable", "Could not save to browser storage. Free space or enable site storage and try again.", 503); }
    notify(record.revision);
  }
  async function readOrInitialize(): Promise<LocalDemoRecord> {
    const current = stored();
    if (current) return current;
    const initial = persistedDemoStateSchema.parse(await initialize());
    const other = stored(); // Another tab may initialize during the await without Web Locks.
    if (other) return other;
    const record: LocalDemoRecord = { storageVersion: 1, state: initial, revision: 0, writerId };
    save(record);
    return record;
  }
  function writeIfCurrent(expected: number, state: PersistedDemoState): LocalDemoRecord | undefined {
    const latest = stored();
    if (!latest || latest.revision !== expected) return;
    const record: LocalDemoRecord = { storageVersion: 1, state, revision: expected + 1, writerId };
    if (!Number.isSafeInteger(record.revision)) throw conflict();
    save(record);
    return record;
  }
  function read() { return exclusive(readOrInitialize); }
  function compareAndSwap(expectedRevision: number, state: PersistedDemoState): Promise<boolean> {
    return exclusive(async () => Boolean(writeIfCurrent(expectedRevision, persistedDemoStateSchema.parse(state))));
  }
  function mutate(update: (state: PersistedDemoState) => Promise<PersistedDemoState> | PersistedDemoState): Promise<LocalDemoRecord> {
    return exclusive(async () => {
      for (let attempt = 0; attempt < 8; attempt++) {
        const before = await readOrInitialize();
        const next = persistedDemoStateSchema.parse(await update(structuredClone(before.state)));
        if (JSON.stringify(next) === JSON.stringify(before.state)) {
          const latest = stored();
          if (latest?.revision === before.revision) return latest;
          continue;
        }
        const saved = writeIfCurrent(before.revision, next);
        if (saved) return saved;
      }
      throw conflict();
    });
  }
  return { read, compareAndSwap, mutate };
}
export type LocalDemoStore = ReturnType<typeof createLocalDemoStore>;
let defaultStore: LocalDemoStore | undefined;
export function getLocalDemoStore(): LocalDemoStore {
  if (typeof window === "undefined") throw new Error("Local demo storage requires a browser");
  if (!defaultStore) {
    let storage: Storage;
    try { storage = window.localStorage; }
    catch { throw new DemoError("local_storage_unavailable", "Browser storage is unavailable. Enable site storage and try again.", 503); }
    defaultStore = createLocalDemoStore({
      storage, notify: publishStateChange,
      lock: navigator.locks ? (work) => navigator.locks.request(DEMO_STORAGE_KEY, work) : undefined,
    });
  }
  return defaultStore;
}
