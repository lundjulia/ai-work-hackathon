import type { NextRequest } from "next/server";

import { ENV } from "@/env.server";
import { DEMO_COOKIE } from "@/lib/demo-session";
import { loadDemoState } from "@/lib/server/demo-store";
import { voiceInstructions, voiceToolDefinitions } from "@/lib/voice-tools";

// Mints a short-lived OpenAI Realtime client secret for the signed-in demo user.
// The browser uses it once to open a WebRTC call directly with OpenAI (see docs/voice.md).
// The standard OPENAI_API_KEY never leaves the server.

const REALTIME_MODEL = "gpt-realtime-2.1";
const VOICE = "marin";
const SECRET_TTL_SECONDS = 120; // only needs to outlive the SDP exchange; the call keeps running after expiry

const noStore = { "Cache-Control": "no-store" };

/** Config probe for the UI: lets /talk show "Voice not configured" before asking for the mic. */
export async function GET(request: NextRequest) {
  if (request.cookies.get(DEMO_COOKIE)?.value !== "sofie") {
    return Response.json({ error: "not_signed_in" }, { status: 401, headers: noStore });
  }
  return Response.json({ configured: Boolean(ENV.OPENAI_API_KEY), model: REALTIME_MODEL }, { headers: noStore });
}

export async function POST(request: NextRequest) {
  if (request.cookies.get(DEMO_COOKIE)?.value !== "sofie") {
    return Response.json({ error: "not_signed_in" }, { status: 401, headers: noStore });
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "invalid_origin" }, { status: 403, headers: noStore });
  }

  const apiKey = ENV.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "voice_not_configured", message: "Voice not configured: OPENAI_API_KEY is not set on the server." },
      { status: 503, headers: noStore },
    );
  }

  let instructions: string;
  try {
    instructions = voiceInstructions(await loadDemoState());
  } catch {
    return Response.json({ error: "financial_data_unavailable" }, { status: 503, headers: noStore });
  }

  const body = {
    expires_after: { anchor: "created_at", seconds: SECRET_TTL_SECONDS },
    session: {
      type: "realtime",
      model: REALTIME_MODEL,
      instructions,
      output_modalities: ["audio"],
      audio: {
        input: {
          noise_reduction: { type: "near_field" },
          transcription: { model: "gpt-4o-mini-transcribe" },
          turn_detection: { type: "semantic_vad", eagerness: "medium" },
        },
        output: { voice: VOICE },
      },
      tools: voiceToolDefinitions(),
      tool_choice: "auto",
    },
  };

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return Response.json({ error: "upstream_unreachable" }, { status: 502, headers: noStore });
  }

  if (!res.ok) {
    // Pass OpenAI's error message through (it never contains the key) to make misconfiguration visible.
    const detail = await res.text().catch(() => "");
    let message = detail.slice(0, 500);
    try {
      message = ((JSON.parse(detail) as { error?: { message?: string } }).error?.message ?? message).slice(0, 500);
    } catch {}
    return Response.json(
      { error: "upstream_error", status: res.status, message },
      { status: 502, headers: noStore },
    );
  }

  const data = (await res.json().catch(() => null)) as { value?: unknown; expires_at?: unknown } | null;
  if (typeof data?.value !== "string" || !data.value || typeof data.expires_at !== "number" || !Number.isFinite(data.expires_at)) {
    return Response.json({ error: "upstream_error", message: "No client secret in response" }, { status: 502, headers: noStore });
  }
  return Response.json(
    { value: data.value, expires_at: data.expires_at, model: REALTIME_MODEL },
    { headers: noStore },
  );
}
