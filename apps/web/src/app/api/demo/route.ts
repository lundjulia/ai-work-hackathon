import type { NextRequest } from "next/server";

import { checkDemoRequest, DEMO_NO_STORE_HEADERS, readBoundedJson } from "@/lib/server/demo-http";
import { DemoError } from "@/lib/server/demo-errors";
import { autopilotSnapshotRequestSchema, DEMO_SNAPSHOT_MAX_BYTES } from "@/lib/demo-state-schema";
import { autopilotConfigured } from "@/lib/server/autopilot";
import { reviewDemoSnapshot } from "@/lib/server/demo-service";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers = DEMO_NO_STORE_HEADERS;

function failure(error: unknown) {
  if (error instanceof DemoError) return Response.json({ error: error.code, message: error.message }, { status: error.status, headers });
  return Response.json({ error: "demo_unavailable", message: "The demo could not complete its review. Please retry." }, { status: 503, headers });
}

export async function GET(request: NextRequest) {
  const denied = checkDemoRequest(request);
  if (denied) return Response.json({ error: denied.error }, { status: denied.status, headers });
  try { return Response.json({ configured: { autopilot: autopilotConfigured() } }, { headers }); }
  catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  const denied = checkDemoRequest(request);
  if (denied) return Response.json({ error: denied.error }, { status: denied.status, headers });
  const body = await readBoundedJson(request, DEMO_SNAPSHOT_MAX_BYTES);
  if (!body.ok) return Response.json({ error: "invalid_request", message: body.error }, { status: body.status, headers });
  const parsed = autopilotSnapshotRequestSchema.safeParse(body.value);
  if (!parsed.success) return Response.json({ error: "invalid_request", message: parsed.error.issues[0]?.message ?? "Invalid demo operation." }, { status: 400, headers });
  try { return Response.json(await reviewDemoSnapshot(parsed.data.snapshot), { headers }); }
  catch (error) { return failure(error); }
}
