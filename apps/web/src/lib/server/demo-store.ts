import { createClient, type Client } from "@libsql/client";

import { ENV } from "../../env.server";
import type { DemoState } from "../demo-types";
import { createInitialDemoState } from "./demo-initial";
import { DemoError } from "./demo-errors";

/** Internal review revision changes whenever goals or connected data change. */
export type PersistedDemoState = DemoState & { goalsRevision: number };
export type StoredDemoState = { state: PersistedDemoState; revision: number };

export const DEMO_STATE_TABLE = "autopilot_demo_state";

/** One JSON row is deliberate for the single-persona hackathon. CAS keeps decisions atomic. */
export function createDemoStore(client: Client, id = "sofie", initialize = createInitialDemoState) {
  let ready: Promise<void> | undefined;

  async function ensureReady() {
    ready ??= (async () => {
      await client.execute(`CREATE TABLE IF NOT EXISTS ${DEMO_STATE_TABLE} (
        id TEXT PRIMARY KEY, state_json TEXT NOT NULL,
        revision INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL
      )`);
    })().catch((error) => { ready = undefined; throw error; });
    await ready;
  }

  async function read(): Promise<StoredDemoState> {
    await ensureReady();
    let result = await client.execute({ sql: `SELECT state_json, revision FROM ${DEMO_STATE_TABLE} WHERE id = ?`, args: [id] });
    if (!result.rows.length) {
      const initial = await initialize();
      await client.execute({
        sql: `INSERT OR IGNORE INTO ${DEMO_STATE_TABLE} (id, state_json, revision, updated_at) VALUES (?, ?, 0, ?)`,
        args: [id, JSON.stringify(initial), new Date().toISOString()],
      });
      result = await client.execute({ sql: `SELECT state_json, revision FROM ${DEMO_STATE_TABLE} WHERE id = ?`, args: [id] });
    }
    const row = result.rows[0];
    if (!row) throw new DemoError("state_unavailable", "Demo state is unavailable. Please retry.", 503);
    const state = JSON.parse(String(row.state_json)) as PersistedDemoState;
    if (state.version !== 1) throw new DemoError("state_version", "Stored demo state needs migration.", 503);
    return { state: { ...state, goalsRevision: state.goalsRevision ?? 0 }, revision: Number(row.revision) };
  }

  async function compareAndSwap(expectedRevision: number, state: PersistedDemoState): Promise<boolean> {
    await ensureReady();
    const result = await client.execute({
      sql: `UPDATE ${DEMO_STATE_TABLE} SET state_json = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?`,
      args: [JSON.stringify(state), new Date().toISOString(), id, expectedRevision],
    });
    return result.rowsAffected === 1;
  }

  async function mutate(update: (state: PersistedDemoState) => Promise<PersistedDemoState> | PersistedDemoState) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const current = await read();
      const draft = structuredClone(current.state);
      const next = await update(draft);
      if (JSON.stringify(next) === JSON.stringify(current.state)) return current.state;
      if (await compareAndSwap(current.revision, next)) return next;
    }
    throw new DemoError("state_conflict", "The demo changed while saving. Please retry.", 409);
  }

  return { read, compareAndSwap, mutate };
}

export type DemoStore = ReturnType<typeof createDemoStore>;
let defaultStore: DemoStore | undefined;

export function getDemoStore(): DemoStore {
  if (!defaultStore) {
    if (!ENV.DATABASE_URL || !ENV.DATABASE_AUTH_TOKEN) {
      throw new DemoError("database_not_configured", "The demo database is not configured.", 503);
    }
    defaultStore = createDemoStore(createClient({ url: ENV.DATABASE_URL, authToken: ENV.DATABASE_AUTH_TOKEN }));
  }
  return defaultStore;
}

export async function loadDemoState(): Promise<PersistedDemoState> {
  return (await getDemoStore().read()).state;
}
