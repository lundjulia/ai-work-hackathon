/** An invalidation signal. Clients reread the financial state in this browser's localStorage. */
export type StateChangedEvent = { revision: number };
export const DEMO_STORAGE_KEY = "autopilot-demo-state-v1";
export const DEMO_STATE_CHANNEL = "autopilot-demo-state";
export const DEMO_STATE_EVENT = "autopilot-state-changed";

export function publishStateChange(revision: number) {
  if (typeof window === "undefined") return;
  const detail: StateChangedEvent = { revision };
  window.dispatchEvent(new CustomEvent(DEMO_STATE_EVENT, { detail }));
  if (typeof BroadcastChannel !== "undefined") {
    try {
      const channel = new BroadcastChannel(DEMO_STATE_CHANNEL);
      channel.postMessage(detail);
      channel.close();
    } catch { /* Storage events still notify other tabs when channels are unavailable. */ }
  }
}

export function parseStateChangedEvent(data: string): StateChangedEvent | undefined {
  try {
    const value: unknown = JSON.parse(data);
    if (typeof value !== "object" || value === null || !("revision" in value)) return;
    const revision = value.revision;
    if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0) return;
    return { revision };
  } catch {
    return;
  }
}
