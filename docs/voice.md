---
provenance: Unvetted Synthetic
---

# Voice (F6): talk to Autopilot with gpt-realtime

Owner: voice worker. Requirements: [PRD](../PRD.md) F6 and demo step 7. Status: [status.md](../status.md).

## Architecture

```text
/talk (browser)                         Next server                        OpenAI
──────────────                          ───────────                        ──────
GET  /api/realtime/session  ─────────►  {configured, model}
tap orb → getUserMedia (mic)
POST /api/realtime/session  ─────────►  POST /v1/realtime/client_secrets ─► ek_… (120 s)
                            ◄─────────  {value, expires_at, model}
RTCPeerConnection + data channel "oai-events"
POST /v1/realtime/calls (SDP offer, Bearer ek_…) ───────────────────────► SDP answer
audio ◄══════════════ WebRTC media + events ══════════════════════════════►
model emits function_call (response.done)
POST /api/realtime/tool {name, arguments} ─►  lib/voice-tools.ts → JSON
data channel: conversation.item.create(function_call_output) + response.create
```

- The standard `OPENAI_API_KEY` stays on the server. The browser only gets an ephemeral client secret, which expires after 120 s. The secret only has to last through the SDP exchange; the call keeps running after it expires. This is the developer-approved "fetch the temp key and use it on the client" approach.
- Session config (instructions, voice, transcription, VAD, tools) is fixed by the server when it mints the secret. The client sends no `session.update`.
- Tools run on our server, not in the browser. The browser only relays the model's call to `/api/realtime/tool` and returns the JSON. Code computes every number; the model only phrases it.

## Files

| Path | Role |
| ---- | ---- |
| `apps/web/src/app/api/realtime/session/route.ts` | `GET` config probe; `POST` mints the ephemeral secret |
| `apps/web/src/app/api/realtime/tool/route.ts` | `POST` runs one tool by name |
| `apps/web/src/lib/voice-tools.ts` | **Single adapter** to finance data: tool schemas, validation, deterministic logic, and the system instructions |
| `apps/web/src/components/voice/use-realtime-voice.ts` | WebRTC connection, event handling, tool relay, mute, text fallback, teardown |
| `apps/web/src/components/voice/voice-panel.tsx`, `voice-orb.tsx`, `voice-transcript.tsx` | UI: orb with states, live transcript, tool chips, suggestions |
| `apps/web/src/app/(tabs)/talk/page.tsx` | The Talk tab |

## Endpoints (ours)

All require `demo_user=sofie` exactly, with 401 for an absent or different cookie, and return `Cache-Control: no-store`. POST routes reject an explicit foreign Origin. The tool request body is bounded at 16 KiB, including chunked bodies; JSON arguments are bounded at 8 KiB. Unknown fields, non-finite or nonnumeric costs, impossible calendar dates, and malformed JSON are rejected. Tool arguments cannot select another user.

| Endpoint | Response |
| -------- | -------- |
| `GET /api/realtime/session` | `{configured: boolean, model}` |
| `POST /api/realtime/session` | 200 `{value, expires_at, model}`, or 503 `{error: "voice_not_configured"}` without a key, or 502 `{error: "upstream_error", status, message}` with OpenAI's message |
| `POST /api/realtime/tool` body `{name, arguments}` (`arguments` is the model's JSON string or an object) | 200 `{ok: true, dataSource, result}`, or 400 `{ok: false, error}` for an unknown tool or invalid arguments. Lookup misses (unknown id or category) return 200 with `result.error` so the model can recover. |

## OpenAI API used

Checked on 2026-10-21 against the current docs:

- Ephemeral key: `POST https://api.openai.com/v1/realtime/client_secrets`, body `{expires_after: {anchor: "created_at", seconds: 10–7200}, session: {type: "realtime", model, instructions, output_modalities, audio: {input: {noise_reduction, transcription, turn_detection}, output: {voice}}, tools, tool_choice}}`. The response is `{value: "ek_…", expires_at, session}`. Reference: https://developers.openai.com/api/reference/resources/realtime/subresources/client_secrets/methods/create
- WebRTC: data channel `oai-events`; `POST https://api.openai.com/v1/realtime/calls` with `Authorization: Bearer <ek>` and `Content-Type: application/sdp`, which returns the answer SDP. Guide: https://developers.openai.com/api/docs/guides/realtime-webrtc
- Tools and events: function tools `{type: "function", name, description, parameters}`. Function calls arrive in `response.done` → `response.output[]` items with `type: "function_call"`, `call_id`, `name`, and `arguments`. Results are sent back with `conversation.item.create` `{type: "function_call_output", call_id, output}` followed by `response.create`. Guide: https://developers.openai.com/api/docs/guides/realtime-conversations
- Events the UI uses: `input_audio_buffer.speech_started/stopped`, `conversation.item.input_audio_transcription.delta/completed/failed`, `response.created`, `response.output_item.added`, `response.output_audio_transcript.delta/done`, `output_audio_buffer.started/stopped/cleared` (WebRTC), `response.done`, `error`.
- Model: `gpt-realtime-2.1`, the latest realtime model with tool use in the models list; the WebRTC guide also uses it. `gpt-realtime`, `-1.5`, and `-2` are still accepted. `gpt-live-1` uses a different session API (`/v1/live/sessions`) with no documented ephemeral key, so it is not used. To change the model, edit `REALTIME_MODEL` in the session route. Models: https://developers.openai.com/api/docs/models
- Voice: `marin`, which the docs recommend along with `cedar`. Others: alloy, ash, ballad, coral, echo, sage, shimmer, verse. The voice can't change after the first audio.
- Input transcription: `gpt-4o-mini-transcribe` with no language pinned (Danish and English both work). Turn detection: `semantic_vad`, eagerness `medium`. Noise reduction: `near_field`.

## Tools

Computed amounts are DKK; per-account balances retain their account currency. Each successful response includes `dataSource: "finance_synthetic_fixture"`. The browser passes the full response envelope to the model.

| Tool | Args | Returns |
| ---- | ---- | ------- |
| `get_overview` | none | total, cash, investments, per-account balances (EUR at the fixed demo rate; Saxo counted once), this month's spending by category, bills in the next 14 days, the forecast low point including pre-salary debits on payday |
| `get_budget_status` | `category?` (any configured category) | per budget: limit, spent, remaining, % used, days left, remaining per day, projected month end, projected over/under |
| `get_action_items` | `status?` (new by default, approved, dismissed, all) | items `{id, type, title, body, amountDkk?, severity, status, createdAt}` |
| `explain_action_item` | `id` | the persisted item and original run facts in `supporting`, plus separately labelled `currentConditions` from the current date and goals |
| `can_i_afford` | `amount_dkk`, `description`, `date?` (`YYYY-MM-DD`, or `YYYY-MM`, which means the 1st for a future month or today for the current month), `category?` | `verdict` (`yes`, `yes_but_over_budget`, `tight` if within 2,000 kr. of the floor, or `no` if below the floor; `insufficient_data` for missing or unsupported forecasts), cash on the date, lowest cash after the spend before the next salary, safety-net floor, headroom, the category budget overrun for that month, the effect if the pending surplus transfer is also approved, and the assumptions. Missing category budgets are explicitly null |
| `get_goals` | none | risk tolerance, income, safety net (floor, target, months covered), savings-goal progress, budget limits |

How `can_i_afford` works: `generateForecast(dataset, domainGoals, horizonDays)` projects the same everyday available DKK cash as the app. It uses recurring salary timing inferred from connected history, recurring bills, scheduled savings transfers, and the greater of historic or budgeted flexible spending. The requested purchase is an extra expense beyond that baseline. The tool subtracts it from the spending date onward and checks the lowest pre-income balance through the next inferred salary date against the configured everyday minimum balance. That minimum is distinct from the savings-account safety-net target.

A future month's category budget starts with its configured limit. This is a planning signal, not a claim that future purchases or commitments are known. The tool states when no budget exists. A pending savings transfer is a separate scenario; approved transfers are already in the persisted balance adjustments. Requests that extend beyond the core's 90-day forecast return `insufficient_data`. Missing salary timing, stale everyday cash, and failed everyday connections also prevent a verdict.

The session instructions give the initial persisted simulated date, define all six tool triggers, and require a fresh tool call for financial answers. Relative-date affordability first retrieves the current simulated date and rechecks if it changed. Missing prices prompt one question for the user's amount. The model does not invent a typical trip cost. An isolated prompt draft and a cold-read audit found and fixed a requirement for supporting numbers when an `insufficient_data` result has none. This audit is not a live model session test.

## Data source

Every `/api/realtime/tool` request loads `loadDemoState()` from `lib/server/demo-store`, then calls `buildFinanceView(state)`. Voice, Home, Goals, and Actions therefore read the same server-owned demo state, connected fixtures, saved goals, date, balance adjustments, and action decisions. No hardcoded voice finance source or separate forecast remains.

At the baseline date 2026-10-19 with all banks connected, the core reports DKK 147,744.57 total, split into DKK 52,744.57 cash and DKK 95,000 investment positions. Cash includes Saxo's DKK 5,000, while the Saxo account's DKK 100,000 balance already includes that cash and its positions. Everyday forecast cash is DKK 21,451 and excludes savings, EUR cash, and Saxo cash.

## Verification on 2026-10-21

- `pnpm exec tsc --noEmit --incremental false` in `apps/web` passed after integration.
- Focused direct tool checks compared totals and purchase low points with the finance core for DKK 375 on 23 October, DKK 8,275 in November, DKK 1,200 on 17 December, and the earlier Lisbon DKK 5,000 case. No-bank, past-date, and beyond-horizon cases returned explicit uncertainty. Saved income, budget, safety-target and date changes propagated. An approved DKK 1,300 transfer reduced everyday forecast cash by DKK 1,300 without changing total cash; action status and original facts followed it.
- Runtime API checks connected all three banks, compared voice balances and spending with `/api/demo`, saved income DKK 38,123, a five-month safety target, restaurant budget DKK 4,175, shopping budget DKK 1,625, and savings target DKK 43,750, then advanced seven days. Voice returned those values and 2026-10-26. Fresh October, November, December, and May purchase cases returned computed verdicts or horizon uncertainty. The demo was reset afterward to 2026-10-19, no connected banks, and `onboarded: false`.
- All six tools returned HTTP 200 over the runtime API. Wrong cookie returned 401; null/malformed bodies, impossible dates, unknown fields, wrong amount types, and unknown tools returned 400. Foreign Origin returned 403. Oversized fixed-length and chunked bodies returned 413.
- `GET /api/realtime/session` returned `configured: false`, model `gpt-realtime-2.1`; `POST` returned 503 `voice_not_configured`. The standard key was absent. The start button now probes config again before `getUserMedia`, including an early click while the page probe is pending.

## Configure

1. Put `OPENAI_API_KEY=sk-…` in `apps/web/.env` (declared optional in `.env.schema`, sensitive). For a Vercel deploy, set it in the project env.
2. Restart the app. `GET /api/realtime/session` should return `configured: true`.
3. Open `/talk` on HTTPS or localhost; a LAN IP over plain HTTP has no `getUserMedia`. Tap the orb and allow the microphone.

Without a key, `/talk` shows "Voice not configured" and never asks for the microphone.

## Limits and known gaps

- **Not yet verified with a real key:** minting the secret, the WebRTC connection, the session config being accepted (in particular `semantic_vad`, the transcription model, and `gpt-realtime-2.1`), and the tool round-trip with the live model. If OpenAI rejects a field, the 502 body carries its message.
- The forecast ignores Danish bank holidays and unknown future purchases. It excludes savings, EUR cash, and investments from spendable cash.
- The ephemeral secret is usable by whoever holds it for 120 s; this is acceptable for the demo per the developer's decision. There is no rate limit on minting beyond the demo cookie.
- The suggestion buttons send typed questions into a live session (`input_text`), which is a fallback when the room is noisy. They still need a connected session.
- Audio autoplay on iOS needs the user's tap, which starting from the orb provides. The connection has not been tested on a real phone.
