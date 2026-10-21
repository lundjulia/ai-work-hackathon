import type { NextRequest } from "next/server";

import { DEMO_COOKIE, DEMO_USER_ID } from "@/lib/demo-session";
import { DemoError } from "@/lib/server/demo-errors";
import { demoOperationSchema } from "@/lib/server/demo-requests";
import { applyDemoOperation, demoResponse } from "@/lib/server/demo-service";
import { loadDemoState } from "@/lib/server/demo-store";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "no-store" };
const authorized = (request: NextRequest) => request.cookies.get(DEMO_COOKIE)?.value === DEMO_USER_ID;

function failure(error: unknown) {
  if (error instanceof DemoError) return Response.json({ error: error.code, message: error.message }, { status: error.status, headers });
  return Response.json({ error: "demo_unavailable", message: "The demo could not load or save its state. Please retry." }, { status: 503, headers });
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return Response.json({ error: "not_signed_in" }, { status: 401, headers });
  try { return Response.json(await demoResponse(await loadDemoState()), { headers }); }
  catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return Response.json({ error: "not_signed_in" }, { status: 401, headers });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "invalid_origin" }, { status: 403, headers });
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "invalid_request", message: "Send a JSON operation." }, { status: 400, headers }); }
  const parsed = demoOperationSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "invalid_request", message: parsed.error.issues[0]?.message ?? "Invalid demo operation." }, { status: 400, headers });
  try { return Response.json(await applyDemoOperation(parsed.data), { headers }); }
  catch (error) { return failure(error); }
}
