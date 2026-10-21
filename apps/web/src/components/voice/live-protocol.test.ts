import assert from "node:assert/strict";
import { test } from "node:test";

import { LiveTranscripts, liveOffer, liveThinking, liveThinkingParts, validLiveSession } from "./live-protocol";

test("Live timed transcript fragments preserve both sides and split silence gaps", () => {
  const transcripts = new LiveTranscripts();
  const first = transcripts.append({ type: "session.input_transcript.delta", delta: "Can I ", start_ms: 0, end_ms: 200 });
  const second = transcripts.append({ type: "session.input_transcript.delta", delta: "afford it?", start_ms: 200, end_ms: 400 });
  assert.equal(second?.text, "Can I afford it?");
  assert.equal(second?.id, first?.id);
  const assistant = transcripts.append({ type: "session.output_transcript.delta", delta: "I'll check", start_ms: 450, end_ms: 600 });
  assert.equal(assistant?.role, "assistant");
  const next = transcripts.append({ type: "session.input_transcript.delta", delta: "Five thousand", start_ms: 700, end_ms: 900 });
  assert.notEqual(next?.id, first?.id);
  const gap = transcripts.append({ type: "session.input_transcript.delta", delta: "Tomorrow", start_ms: 4000, end_ms: 4300 });
  assert.notEqual(gap?.id, next?.id);
  assert.equal(transcripts.append({ type: "response.output_audio_transcript.delta", delta: "old protocol" }), null);
});

test("client delegation results use bounded quiet context and preserve correlation", () => {
  const result = liveThinking("x".repeat(1000), "delegation-123");
  assert.equal(result.type, "session.thinking.append");
  assert.equal(result.delegation_id, "delegation-123");
  assert.equal(result.content.length, 400);
  assert.equal(liveThinking("User typed a question").delegation_id, null);
  assert.ok(result.event_id);
  const complete = "The balance is DKK 12,789. " + "x".repeat(1100);
  const parts = liveThinkingParts(complete, "delegation-123");
  assert.equal(parts.map((part) => part.content).join(""), complete);
  assert.ok(parts.every((part) => part.content.length <= 400 && part.delegation_id === "delegation-123"));
});

test("media activates only for the matching GPT-Live client session", () => {
  const session = { id: "session-123", model: "gpt-live-1", delegation: { type: "client" } };
  assert.equal(validLiveSession({ type: "session.started", session }, "session-123", "gpt-live-1"), true);
  assert.equal(validLiveSession({ type: "session.started", session }, "other", "gpt-live-1"), false);
  assert.equal(validLiveSession({ type: "session.started", session: { ...session, delegation: { type: "responses" } } }, "session-123", "gpt-live-1"), false);
});

test("Live SDP submission uses the gathered local offer and honors cancellation", async () => {
  const peer = {
    iceGatheringState: "complete",
    localDescription: { sdp: "gathered-offer" },
    createOffer: async () => ({ type: "offer", sdp: "initial-offer" }),
    setLocalDescription: async () => {},
  } as unknown as RTCPeerConnection;
  assert.equal(await liveOffer(peer, new AbortController().signal), "gathered-offer");
  const canceled = new AbortController(); canceled.abort();
  await assert.rejects(() => liveOffer(peer, canceled.signal), /canceled/);
});
