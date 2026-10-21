import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";

import { DEMO_COOKIE, DEMO_USER_ID } from "../demo-session";
import { checkDemoRequest, readBoundedJson } from "./demo-http";

const url = "https://autopilot.example/api/realtime/tool";
const signedIn = { cookie: `${DEMO_COOKIE}=${DEMO_USER_ID}` };

function request(headers: Record<string, string> = {}) {
  return new NextRequest(url, { headers });
}

function streamedBody(chunks: string[], headers: Record<string, string> = {}, cancel?: () => void | Promise<void>) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
    cancel,
  });
  return new Request(url, { method: "POST", body, headers, duplex: "half" } as RequestInit & { duplex: "half" });
}

test("only the exact demo persona cookie authorizes a request", () => {
  for (const cookie of [undefined, "other=sofie", `${DEMO_COOKIE}=another`, `${DEMO_COOKIE}=sofie-extra`, `${DEMO_COOKIE}=`]) {
    assert.deepEqual(checkDemoRequest(request(cookie ? { cookie } : {})), { error: "not_signed_in", status: 401 });
  }
  assert.equal(checkDemoRequest(request(signedIn)), null);
  assert.equal(checkDemoRequest(request({ cookie: `other=user; ${signedIn.cookie}; preference=dark` })), null);
});

test("supplied foreign, null and empty origins are rejected after authorization", () => {
  for (const origin of ["https://foreign.example", "https://autopilot.example:444", "http://autopilot.example", "null", ""]) {
    assert.deepEqual(checkDemoRequest(request({ ...signedIn, origin })), { error: "invalid_origin", status: 403 });
  }
  assert.equal(checkDemoRequest(request({ ...signedIn, origin: new URL(url).origin })), null);
  assert.deepEqual(checkDemoRequest(request({ origin: "https://foreign.example" })), { error: "not_signed_in", status: 401 });
});

test("cross-site fetch metadata rejects requests even when Origin is absent or same-origin", () => {
  for (const origin of [undefined, new URL(url).origin]) {
    assert.deepEqual(checkDemoRequest(request({ ...signedIn, ...(origin ? { origin } : {}), "sec-fetch-site": "cross-site" })), { error: "invalid_origin", status: 403 });
  }
  for (const site of ["same-origin", "same-site", "none"]) {
    assert.equal(checkDemoRequest(request({ ...signedIn, "sec-fetch-site": site })), null);
  }
});

test("JSON at the byte limit is accepted, including split UTF-8 characters", async () => {
  const encoded = new TextEncoder().encode(JSON.stringify({ text: "æ🦉" }));
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const byte of encoded) controller.enqueue(Uint8Array.of(byte));
      controller.close();
    },
  });
  const input = new Request(url, { method: "POST", body, duplex: "half" } as RequestInit & { duplex: "half" });
  assert.deepEqual(await readBoundedJson(input, encoded.byteLength), { ok: true, value: { text: "æ🦉" } });
  assert.equal(input.body?.locked, false);
});

test("streamed JSON over the byte limit is rejected without a truthful Content-Length", async () => {
  const headerCases: Record<string, string>[] = [{}, { "content-length": "2" }, { "content-length": "unknown" }];
  for (const headers of headerCases) {
    const input = streamedBody(["{\"text\":\"", "🦉".repeat(8), "\"}"], headers);
    assert.deepEqual(await readBoundedJson(input, 16), { ok: false, error: "Body too large", status: 413 });
    assert.equal(input.body?.locked, false);
  }
});

test("declared oversized bodies are rejected before parsing", async () => {
  assert.deepEqual(await readBoundedJson(streamedBody(["{}"], { "content-length": "500" }), 16), { ok: false, error: "Body too large", status: 413 });
});

test("oversized stream cancellation failures preserve the size rejection", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new Uint8Array(17)); },
    cancel() { cancelled = true; throw new Error("cancel failed"); },
  });
  const input = new Request(url, { method: "POST", body, duplex: "half" } as RequestInit & { duplex: "half" });
  assert.deepEqual(await readBoundedJson(input, 16), { ok: false, error: "Body too large", status: 413 });
  assert.equal(cancelled, true);
  assert.equal(body.locked, false);
});

test("missing, empty, malformed and unreadable bodies return the JSON error", async () => {
  const broken = new ReadableStream<Uint8Array>({ start(controller) { controller.error(new Error("read failed")); } });
  const inputs = [
    new Request(url, { method: "POST" }),
    streamedBody([]),
    streamedBody(["{oops"]),
    new Request(url, { method: "POST", body: broken, duplex: "half" } as RequestInit & { duplex: "half" }),
  ];
  for (const input of inputs) {
    assert.deepEqual(await readBoundedJson(input, 16), { ok: false, error: "Body must be JSON", status: 400 });
  }
});
