import { DEMO_STATE_CHANNEL, DEMO_STATE_EVENT, DEMO_STORAGE_KEY, parseStateChangedEvent } from "./state-events";

/** One same-origin subscription per app store, with storage events when BroadcastChannel is absent. */
export function subscribeToStateChanges(invalidate: () => void): () => void {
  let scheduled = false;
  let stopped = false;
  let channel: BroadcastChannel | undefined;
  const refresh = () => {
    if (scheduled || stopped) return;
    scheduled = true;
    queueMicrotask(() => { scheduled = false; if (!stopped) invalidate(); });
  };
  const onMessage = (event: MessageEvent<unknown>) => {
    try { if (parseStateChangedEvent(JSON.stringify(event.data))) refresh(); } catch {}
  };
  const onStorage = (event: StorageEvent) => {
    if ((event.key === DEMO_STORAGE_KEY || event.key === null) && event.storageArea === window.localStorage) refresh();
  };
  const onVisible = () => { if (document.visibilityState !== "hidden") refresh(); };
  if (typeof BroadcastChannel !== "undefined") {
    try {
      channel = new BroadcastChannel(DEMO_STATE_CHANNEL);
      channel.addEventListener("message", onMessage);
    } catch { /* The storage listener remains available. */ }
  }
  window.addEventListener(DEMO_STATE_EVENT, refresh);
  window.addEventListener("storage", onStorage);
  window.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", onVisible);
  refresh();
  return () => {
    stopped = true;
    channel?.close();
    window.removeEventListener(DEMO_STATE_EVENT, refresh);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("focus", refresh);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
