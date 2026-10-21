import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";

import { ENV } from "../../env.server";
import { GET as getSession, POST as postSession } from "../../app/api/realtime/session/route";
import { POST as postTool } from "../../app/api/realtime/tool/route";
import { ACCOUNT_IDS } from "@claude-impact-lab/finance";
import { createInitialDemoState } from "../demo-initial";
import { DEMO_COOKIE, DEMO_USER_ID } from "../demo-session";
import { VOICE_REQUEST_MAX_BYTES, voiceSessionRequestSchema, voiceToolRequestSchema } from "./voice-requests";

const url = "https://autopilot.example/api/realtime/tool";
const sdp = "v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n";
const headers = { cookie: `${DEMO_COOKIE}=${DEMO_USER_ID}`, "content-type": "application/json" };

function request(body: unknown, extraHeaders: Record<string, string> = {}) {
  return new NextRequest(url, { method: "POST", headers: { ...headers, ...extraHeaders }, body: JSON.stringify(body) });
}

test("voice request schemas require strict validated browser snapshots", async () => {
  const snapshot = await createInitialDemoState();
  assert.equal(voiceSessionRequestSchema.safeParse({ snapshot, sdp }).success, true);
  assert.equal(voiceToolRequestSchema.safeParse({ snapshot, name: "get_goals", arguments: "{}" }).success, true);
  for (const body of [{}, { snapshot: null }, { snapshot: { ...snapshot, goalsRevision: -1 } }, { snapshot, userId: "another" }]) {
    assert.equal(voiceSessionRequestSchema.safeParse(body).success, false);
  }
  assert.equal(voiceToolRequestSchema.safeParse({ snapshot, name: "get_goals", arguments: "a".repeat(8_193) }).success, false);
  assert.equal(voiceToolRequestSchema.safeParse({ snapshot, name: "get_goals", userId: "another" }).success, false);
});

test("tool route computes each answer from the submitted snapshot", async () => {
  const snapshot = await createInitialDemoState();
  const before = await postTool(request({ snapshot, name: "get_goals" }));
  assert.equal(before.status, 200);
  assert.equal(before.headers.get("cache-control"), "no-store");
  const first = await before.json();

  const changed = { ...snapshot, simulatedDate: "2026-10-26", goalsRevision: snapshot.goalsRevision + 1, goals: { ...snapshot.goals, monthlyIncome: snapshot.goals.monthlyIncome + 7_123 } };
  const after = await postTool(request({ snapshot: changed, name: "get_goals" }));
  assert.equal(after.status, 200);
  const second = await after.json();
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.result.monthlyNetIncomeDkk, snapshot.goals.monthlyIncome);
  assert.equal(first.result.today, snapshot.simulatedDate);
  assert.equal(second.result.monthlyNetIncomeDkk, changed.goals.monthlyIncome);
  assert.equal(second.result.today, changed.simulatedDate);
});

test("tool route rejects missing snapshots, extra fields and unknown tools", async () => {
  const snapshot = await createInitialDemoState();
  for (const body of [{ name: "get_goals" }, { snapshot, name: "get_goals", userId: "another" }, { snapshot, name: "not_a_tool" }]) {
    const response = await postTool(request(body));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).ok, false);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
});

test("all existing voice tools execute against browser snapshots and connected fixtures", async () => {
  const snapshot = { ...await createInitialDemoState(), connectedBanks: ["danske", "revolut", "saxo"] as const };
  const mutableSnapshot = { ...snapshot, connectedBanks: [...snapshot.connectedBanks] };
  const calls = [
    { name: "get_overview" },
    { name: "get_budget_status", arguments: { category: "groceries" } },
    { name: "get_action_items" },
    { name: "explain_action_item", arguments: { id: "missing" } },
    { name: "can_i_afford", arguments: { amount_dkk: 375, description: "Family outing", date: "2026-10-23" } },
    { name: "get_goals" },
  ];
  for (const call of calls) {
    const response = await postTool(request({ snapshot: mutableSnapshot, ...call }));
    assert.equal(response.status, 200, call.name);
    const result = await response.json();
    assert.equal(result.ok, true, call.name);
    assert.equal(result.dataSource, "finance_synthetic_fixture");
  }

  const baseline = await (await postTool(request({ snapshot: mutableSnapshot, name: "get_overview" }))).json();
  const adjusted = { ...mutableSnapshot, adjustments: { [ACCOUNT_IDS.danskeEveryday]: -1_300, [ACCOUNT_IDS.danskeSavings]: 1_300 } };
  const changed = await (await postTool(request({ snapshot: adjusted, name: "get_overview" }))).json();
  const beforeAccount = baseline.result.accounts.find((account: { id: string }) => account.id === ACCOUNT_IDS.danskeEveryday);
  const afterAccount = changed.result.accounts.find((account: { id: string }) => account.id === ACCOUNT_IDS.danskeEveryday);
  assert.equal(afterAccount.balance, beforeAccount.balance - 1_300);
});

test("voice routes enforce authorization and origin guards before body processing", async () => {
  for (const handler of [postTool, postSession]) {
    const unsigned = await handler(new NextRequest(url, { method: "POST" }));
    assert.equal(unsigned.status, 401);
    assert.equal((await unsigned.json()).error, "not_signed_in");
    const foreign = await handler(request({}, { "sec-fetch-site": "cross-site" }));
    assert.equal(foreign.status, 403);
    assert.equal((await foreign.json()).error, "invalid_origin");
  }
});

test("voice routes reject malformed and oversized JSON without an upstream call", async () => {
  for (const handler of [postTool, postSession]) {
    const malformed = await handler(new NextRequest(url, { method: "POST", headers, body: "{oops" }));
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json()).error, "Body must be JSON");
    const oversized = await handler(new NextRequest(url, { method: "POST", headers, body: " ".repeat(VOICE_REQUEST_MAX_BYTES + 1) }));
    assert.equal(oversized.status, 413);
    assert.equal((await oversized.json()).error, "Body too large");
  }
});

test("config GET needs no snapshot and valid session requests preserve missing-key behavior", { skip: Boolean(ENV.AZURE_OPENAI_ENDPOINT && ENV.AZURE_OPENAI_REALTIME_DEPLOYMENT && ENV.AZURE_OPENAI_API_KEY) }, async () => {
  const config = await getSession(new NextRequest(url, { headers }));
  assert.equal(config.status, 200);
  const body = await config.json();
  assert.equal(body.configured, false);
  assert.equal(body.provider, "azure");
  assert.equal(body.model, ENV.AZURE_OPENAI_REALTIME_DEPLOYMENT?.trim() || null);
  assert.equal(body.error, "voice_not_configured");
  const response = await postSession(request({ snapshot: await createInitialDemoState(), sdp }));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "voice_not_configured");
});
