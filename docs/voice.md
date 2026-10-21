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

All require the `demo_user` cookie (401 otherwise) and return `Cache-Control: no-store`.

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

All amounts are DKK. Every result includes `dataSource` (`placeholder` until the finance core is wired).

| Tool | Args | Returns |
| ---- | ---- | ------- |
| `get_overview` | none | total, cash, investments, per-account balances (EUR at the fixed demo rate; Saxo counted once), this month's spending by category, bills in the next 14 days, the cash low point before the next salary |
| `get_budget_status` | `category?` (groceries, restaurants, transport, shopping, entertainment, travel) | per budget: limit, spent, remaining, % used, days left, remaining per day, projected month end, projected over/under |
| `get_action_items` | `status?` (new by default, approved, dismissed, all) | items `{id, type, title, body, amountDkk?, severity, status, createdAt}` |
| `explain_action_item` | `id` | the item plus rationale and `supporting` numbers (the budget status, or the forecast low point with and without the transfer) |
| `can_i_afford` | `amount_dkk`, `description`, `date?` (`YYYY-MM-DD`, or `YYYY-MM`, which means the 1st as the conservative case), `category?` | `verdict` (`yes`, `yes_but_over_budget`, `tight` if within 2,000 kr. of the floor, or `no` if below the floor), cash on the date, lowest cash after the spend before the next salary, safety-net floor, headroom, the category budget overrun for that month, the effect if the pending surplus transfer is also approved, and the assumptions |
| `get_goals` | none | risk tolerance, income, safety net (floor, target, months covered), savings-goal progress, budget limits |

How `can_i_afford` works: it forecasts spendable DKK cash (Danske plus Revolut DKK) day by day. Variable spending follows the budget pace (travel only when planned), recurring bills fall on their days, and salary arrives on the last weekday of the month. It subtracts the spend from the spend date onwards and checks the lowest point before the next salary against the safety-net floor. It also checks the category budget for that month. Placeholder result for "Lisbon, 5,000 kr., 2026-11, travel": `yes_but_over_budget`. The low point is 17,249 kr. on 29 Nov against a 10,000 kr. floor, and the spend goes 2,000 kr. over the 3,000 kr. travel budget.

The system instructions (`voiceInstructions()`) give the persona, today's simulated date for resolving relative dates, the rule to use tools and never invent numbers, the reply language (the user's), and short voice-style replies. If the user gives no price, the model states an assumed cost out loud and checks that amount.

## Data source (placeholder → finance core)

`voice-tools.ts` reads everything through a `VoiceDataSource` object. Today it uses `placeholderSource`, a set of clearly marked invented numbers following the fixture targets in [demo-data-availability.md](demo-data-availability.md) (Danske 18,500, Revolut 3,200 + EUR 140, Saxo 100,000). The simulated date is 2026-10-21. The restaurant budget is at 85% with 10 days left, there is a 3,000 kr. surplus, and the refinancing figures are placeholders.

To switch to the real data, once `@claude-impact-lab/finance` is a dependency of `apps/web`, implement `VoiceDataSource` on top of the finance API (accounts, budgets, recurring, action items, goals, clock). Then point `dataSource` at it. Better still, replace the local forecast with the finance core's forecast and safety-net functions. The tool contracts above stay the same.

## Configure

1. Put `OPENAI_API_KEY=sk-…` in `apps/web/.env` (declared optional in `.env.schema`, sensitive). For a Vercel deploy, set it in the project env.
2. Restart the app. `GET /api/realtime/session` should return `configured: true`.
3. Open `/talk` on HTTPS or localhost; a LAN IP over plain HTTP has no `getUserMedia`. Tap the orb and allow the microphone.

Without a key, `/talk` shows "Voice not configured" and never asks for the microphone.

## Limits and known gaps

- **Not yet verified with a real key:** minting the secret, the WebRTC connection, the session config being accepted (in particular `semantic_vad`, the transcription model, and `gpt-realtime-2.1`), and the tool round-trip with the live model. If OpenAI rejects a field, the 502 body carries its message.
- The data is placeholder data until the finance core is wired. Approving an action item elsewhere does not yet change voice answers.
- The forecast ignores Danish bank holidays and treats EUR cash and investments as non-spendable.
- The ephemeral secret is usable by whoever holds it for 120 s; this is acceptable for the demo per the developer's decision. There is no rate limit on minting beyond the demo cookie.
- The suggestion buttons send typed questions into a live session (`input_text`), which is a fallback when the room is noisy. They still need a connected session.
- Audio autoplay on iOS needs the user's tap, which starting from the orb provides. The connection has not been tested on a real phone.
