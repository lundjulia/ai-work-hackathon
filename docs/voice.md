---
provenance: Unvetted Synthetic
---

# GPT-Live voice and Haiku delegation

The app uses Azure `gpt-live-1` for voice and Claude Haiku 5.5 for financial reasoning. GPT-Live does not support ephemeral client keys. The browser creates a WebRTC SDP offer and POSTs `{snapshot,sdp,mode?,notificationId?}` to `/api/realtime/session`. The server validates the snapshot and bounded offer, then sends it with server-held credentials to `/openai/v1/live/sessions`. It returns only the SDP answer, session ID and model. The browser accepts the answer and enables media after a matching `session.started` event.

The Live session uses client delegation. Financial questions reach `/api/assistant/chat` with a fresh browser snapshot. Haiku calls deterministic finance tools and returns validated cards and text. Revision checks reject stale results. The browser supplies the answer back through correlated `session.thinking.append` events. Live transcript events are `session.input_transcript.delta` and `session.output_transcript.delta`; Realtime events and temporary-key endpoints are not used by the active hook. Settings still require the explicit UI confirmation.

## Configuration

Ignored `apps/web/.env` contains the Azure endpoint, deployment and key. `scripts/dev.mjs` overlays these local Azure settings over stale inherited host variables before starting Next. It does not print credentials. The previous 401 was caused by an inherited key overriding the valid local credential. Production uses deployment-managed environment variables.

Both Azure resource hostname forms are accepted. The user supplied the Foundry services endpoint. HTTPS, path, host, credential and size checks remain. No credential or SDP is stored in documentation.

## Verification

Main verified a real session HTTP 200, browser acceptance of the SDP answer, connected WebRTC, open data channel, and matching `session.started` for `gpt-live-1`. The test used an audio transceiver without microphone capture. This establishes the handshake and transport; it does not establish spoken question fidelity or a complete live Haiku delegation roundtrip.

Twelve focused session/protocol/snapshot tests passed; the missing-key case was skipped with configured env. Web TypeScript passed. Client protocol tests cover transcript fragments, bounded correlated context, media gating and SDP cancellation. A final build is recorded in status.

## Limits

The user verified localhost microphone input, audible response and matching groceries card. Phone/device and broader conversation checks remain. Live transcript inactivity drives speaking/listening status because there is no documented audio-done event. Transcript settling and cancellation during delegation need real conversation checks. Stopping disables tracks and closes the peer immediately. Typed Haiku chat remains available when voice is unavailable.

Sources: [GPT-Live WebRTC](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/gpt-live-webrtc), [delegation](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/gpt-live-delegation), [Live reference](https://learn.microsoft.com/en-us/azure/foundry/openai/gpt-live-reference). The comparison implementation in jonashoyer/hckthn-impact uses the same backend SDP transport.

## User acceptance evidence

The user replied "Yes, voice and card work" after the actual localhost3001 microphone question "How is our grocery budget doing?". This establishes audible response and matching card for that interaction. The family UI owner also reports real Haiku settings-card onboarding, explicit save and a notification-to-groceries-card flow using the saved 3500 budget. Receipt classification/allocation and broader live conversation failure cases are still pending.
