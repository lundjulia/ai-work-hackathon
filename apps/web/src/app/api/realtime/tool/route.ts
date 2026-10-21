import type { NextRequest } from "next/server";

import { DEMO_COOKIE } from "@/lib/demo-session";
import { runVoiceTool } from "@/lib/voice-tools";

// Executes one voice tool call for the signed-in demo user.
// Body: { name: string, arguments?: string | object } (arguments as sent by the Realtime model).
// Returns { ok: true, dataSource, result } or { ok: false, error }.

const noStore = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  if (!request.cookies.get(DEMO_COOKIE)?.value) {
    return Response.json({ ok: false, error: "not_signed_in" }, { status: 401, headers: noStore });
  }

  let body: { name?: unknown; arguments?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Body must be JSON" }, { status: 400, headers: noStore });
  }
  if (typeof body.name !== "string") {
    return Response.json({ ok: false, error: "Missing tool name" }, { status: 400, headers: noStore });
  }

  const out = runVoiceTool(body.name, body.arguments);
  return Response.json(out, { status: out.ok ? 200 : 400, headers: noStore });
}
