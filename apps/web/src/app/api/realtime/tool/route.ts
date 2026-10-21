import type { NextRequest } from "next/server";

import { checkDemoRequest, DEMO_NO_STORE_HEADERS as noStore, readBoundedJson } from "@/lib/server/demo-http";
import { VOICE_REQUEST_MAX_BYTES, voiceToolRequestSchema } from "@/lib/server/voice-requests";
import { isVoiceToolName, runVoiceTool } from "@/lib/voice-tools";

// Executes one voice tool call for the signed-in demo user.
// Body: { snapshot, name: string, arguments?: string | object } from current browser demo state.
// Returns { ok: true, dataSource, result, artifact? } or { ok: false, error }.

export async function POST(request: NextRequest) {
  const denied = checkDemoRequest(request);
  if (denied) {
    return Response.json({ ok: false, error: denied.error }, { status: denied.status, headers: noStore });
  }

  const body = await readBoundedJson(request, VOICE_REQUEST_MAX_BYTES);
  if (!body.ok) {
    return Response.json({ ok: false, error: body.error }, { status: body.status, headers: noStore });
  }
  const parsed = voiceToolRequestSchema.safeParse(body.value);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "Expected a valid demo snapshot, tool name and optional JSON arguments" }, { status: 400, headers: noStore });
  }
  if (!isVoiceToolName(parsed.data.name)) {
    return Response.json({ ok: false, error: `Unknown tool "${parsed.data.name}"` }, { status: 400, headers: noStore });
  }

  try {
    const out = await runVoiceTool(parsed.data.name, parsed.data.arguments, parsed.data.snapshot, { mode: parsed.data.mode, notificationId: parsed.data.notificationId });
    return Response.json(out, { status: out.ok ? 200 : 400, headers: noStore });
  } catch {
    return Response.json({ ok: false, error: "Financial data is unavailable. Try again." }, { status: 503, headers: noStore });
  }
}
