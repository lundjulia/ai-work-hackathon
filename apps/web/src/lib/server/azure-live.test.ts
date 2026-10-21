import assert from "node:assert/strict";
import { test } from "node:test";
import { azureRealtimeConfig } from "./azure-realtime";
import { createAzureLiveSession } from "./azure-live";
const settings = azureRealtimeConfig({ endpoint: "https://demo.services.ai.azure.com", deployment: "gpt-live-1", apiKey: "synthetic-secret" });
if (!settings.ok) throw Error("bad test config");
const config = settings.config;
const sdp = "v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n";
test("Live exchanges SDP with client delegation and no ephemeral credential", async () => {
  const result = await createAzureLiveSession(config, "Delegate financial questions", sdp, async (url, init) => {
    assert.equal(String(url), "https://demo.services.ai.azure.com/openai/v1/live/sessions");
    assert.equal(new Headers(init?.headers).get("api-key"), "synthetic-secret");
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(body.session.delegation, { type: "client" });
    assert.deepEqual(body.transport, { type: "webrtc", sdp });
    return Response.json({ session: { id: "session-test", model: "gpt-live-1" }, transport: { sdp } });
  });
  assert.deepEqual(result, { ok: true, sdp, sessionId: "session-test" });
});
test("invalid offers and answers fail without exposing credentials", async () => {
  let called = false;
  assert.equal((await createAzureLiveSession(config, "", "bad", async () => { called = true; return Response.json({}); })).ok, false);
  assert.equal(called, false);
  assert.equal((await createAzureLiveSession(config, "", sdp, async () => Response.json({ session: { id: "test" }, transport: { sdp: "bad" } }))).ok, false);
  const error = await createAzureLiveSession(config, "", sdp, async () => Response.json({ error: { message: "Rejected synthetic-secret" } }, { status: 401 }));
  assert.equal(error.ok, false);
  if (!error.ok) assert.equal(error.message, "Rejected [redacted]");
});
