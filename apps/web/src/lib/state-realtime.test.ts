import assert from "node:assert/strict";
import { test } from "node:test";
import { subscribeToStateChanges } from "./state-realtime";
import { DEMO_STATE_EVENT, DEMO_STORAGE_KEY, parseStateChangedEvent } from "./state-events";

test("subscription coalesces updates, falls back to storage, and releases every listener", async () => {
  class Surface extends EventTarget {
    listeners = 0;
    localStorage = {};
    visibilityState = "visible";
    override addEventListener(...args: Parameters<EventTarget["addEventListener"]>) { this.listeners++; super.addEventListener(...args); }
    override removeEventListener(...args: Parameters<EventTarget["removeEventListener"]>) { this.listeners--; super.removeEventListener(...args); }
  }
  const browser = new Surface();
  const page = new Surface();
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const originalChannel = Object.getOwnPropertyDescriptor(globalThis, "BroadcastChannel");
  Object.defineProperty(globalThis, "window", { configurable: true, value: browser });
  Object.defineProperty(globalThis, "document", { configurable: true, value: page });
  Object.defineProperty(globalThis, "BroadcastChannel", { configurable: true, value: undefined });
  const restore = (name: string, descriptor?: PropertyDescriptor) => {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  };
  try {
    let updates = 0;
    const cleanup = subscribeToStateChanges(() => updates++);
    browser.dispatchEvent(new Event(DEMO_STATE_EVENT));
    browser.dispatchEvent(new Event("focus"));
    await Promise.resolve();
    assert.equal(updates, 1);
    const storage = new Event("storage");
    Object.assign(storage, { key: DEMO_STORAGE_KEY, storageArea: browser.localStorage });
    browser.dispatchEvent(storage);
    await Promise.resolve();
    assert.equal(updates, 2);
    browser.dispatchEvent(new Event(DEMO_STATE_EVENT));
    cleanup();
    await Promise.resolve();
    assert.equal(updates, 2);
    assert.equal(browser.listeners, 0);
    assert.equal(page.listeners, 0);
  } finally {
    restore("window", originalWindow); restore("document", originalDocument); restore("BroadcastChannel", originalChannel);
  }
});

test("malformed revision notifications are ignored", () => {
  assert.deepEqual(parseStateChangedEvent('{"revision":3}'), { revision: 3 });
  for (const data of ["oops", "null", '{}', '{"revision":-1}', '{"revision":1.5}', '{"revision":"2"}']) {
    assert.equal(parseStateChangedEvent(data), undefined);
  }
});
