import type { NextRequest } from "next/server";
import { z } from "zod";

import { DEMO_COOKIE } from "@/lib/demo-session";
import { loadDemoState } from "@/lib/server/demo-store";
import { runVoiceTool } from "@/lib/voice-tools";

// Executes one voice tool call for the signed-in demo user.
// Body: { name: string, arguments?: string | object } (arguments as sent by the Realtime model).
// Returns { ok: true, dataSource, result } or { ok: false, error }.

const noStore = { "Cache-Control": "no-store" };
const MAX_BODY_BYTES = 16_384;
const bodySchema = z.object({
  name: z.string().min(1).max(80),
  arguments: z.union([z.string().max(8_192), z.record(z.string(), z.unknown())]).optional(),
}).strict();

export async function POST(request: NextRequest) {
  if (request.cookies.get(DEMO_COOKIE)?.value !== "sofie") {
    return Response.json({ ok: false, error: "not_signed_in" }, { status: 401, headers: noStore });
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ ok: false, error: "invalid_origin" }, { status: 403, headers: noStore });
  }

  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
    return Response.json({ ok: false, error: "Body too large" }, { status: 413, headers: noStore });
  }
  let rawBody: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Missing body");
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel();
        return Response.json({ ok: false, error: "Body too large" }, { status: 413, headers: noStore });
      }
      chunks.push(value);
    }
    const body = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
    rawBody = JSON.parse(new TextDecoder().decode(body));
  } catch {
    return Response.json({ ok: false, error: "Body must be JSON" }, { status: 400, headers: noStore });
  }
  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "Expected a tool name and optional JSON arguments" }, { status: 400, headers: noStore });
  }

  try {
    const state = await loadDemoState();
    const out = await runVoiceTool(parsed.data.name, parsed.data.arguments, state);
    return Response.json(out, { status: out.ok ? 200 : 400, headers: noStore });
  } catch {
    return Response.json({ ok: false, error: "Financial data is unavailable. Try again." }, { status: 503, headers: noStore });
  }
}
