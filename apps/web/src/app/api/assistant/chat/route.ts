import type { NextRequest } from "next/server";

import { assistantChat, assistantChatRequestSchema, ASSISTANT_CHAT_MAX_BYTES } from "@/lib/server/assistant-chat";
import { DemoError } from "@/lib/server/demo-errors";
import { checkDemoRequest, DEMO_NO_STORE_HEADERS as noStore, readBoundedJson } from "@/lib/server/demo-http";

export const maxDuration = 50;

/** Text fallback only; responses never write settings or approve actions. */
export async function POST(request: NextRequest) {
  const denied = checkDemoRequest(request);
  if (denied) return Response.json({ error: denied.error, message: "Sign in to this demo to use the assistant." }, { status: denied.status, headers: noStore });
  const body = await readBoundedJson(request, ASSISTANT_CHAT_MAX_BYTES);
  if (!body.ok) return Response.json({ error: body.error, message: body.error }, { status: body.status, headers: noStore });
  const parsed = assistantChatRequestSchema.safeParse(body.value);
  if (!parsed.success) {
    return Response.json({ error: "invalid_chat_request", message: "Send a valid financial snapshot and a short conversation." }, { status: 400, headers: noStore });
  }
  try {
    return Response.json(await assistantChat(parsed.data), { headers: noStore });
  } catch (error) {
    const known = error instanceof DemoError;
    return Response.json({ error: known ? error.code : "assistant_unavailable", message: known ? error.message : "The assistant could not finish. Please try again." }, { status: known ? error.status : 502, headers: noStore });
  }
}
