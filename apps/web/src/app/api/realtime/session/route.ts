import type { NextRequest } from "next/server";
import { createAzureLiveSession, plausibleLiveSdp } from "@/lib/server/azure-live";

import { ENV } from "@/env.server";
import { azureRealtimeConfig } from "@/lib/server/azure-realtime";
import { checkDemoRequest, DEMO_NO_STORE_HEADERS as noStore, readBoundedJson } from "@/lib/server/demo-http";
import { VOICE_REQUEST_MAX_BYTES, voiceSessionRequestSchema } from "@/lib/server/voice-requests";
import { voiceInstructions } from "@/lib/voice-tools";

// Azure OpenAI GA WebRTC. Resource credentials stay on this server;
// the browser receives only the SDP answer and session ID.
function providerConfig() {
  return azureRealtimeConfig({
    endpoint: ENV.AZURE_OPENAI_ENDPOINT,
    deployment: ENV.AZURE_OPENAI_REALTIME_DEPLOYMENT,
    apiKey: ENV.AZURE_OPENAI_API_KEY,
  });
}

/** Config probe for the assistant UI before asking for the microphone. */
export async function GET(request: NextRequest) {
  const denied = checkDemoRequest(request);
  if (denied) {
    return Response.json({ error: denied.error }, { status: denied.status, headers: noStore });
  }
  const provider = providerConfig();
  return Response.json(provider.ok
    ? { configured: true, provider: "azure", model: provider.config.deployment }
    : { configured: false, provider: "azure", model: provider.model, error: provider.error, message: provider.message },
  { headers: noStore });
}

export async function POST(request: NextRequest) {
  const denied = checkDemoRequest(request);
  if (denied) {
    return Response.json({ error: denied.error }, { status: denied.status, headers: noStore });
  }

  const input = await readBoundedJson(request, VOICE_REQUEST_MAX_BYTES);
  if (!input.ok) {
    return Response.json({ error: input.error }, { status: input.status, headers: noStore });
  }
  const parsed = voiceSessionRequestSchema.safeParse(input.value);
  if (!parsed.success || !plausibleLiveSdp(parsed.data.sdp)) {
    return Response.json({ error: "Expected a valid demo snapshot" }, { status: 400, headers: noStore });
  }

  const provider = providerConfig();
  if (!provider.ok) {
    return Response.json(
      { error: provider.error, message: provider.message },
      { status: 503, headers: noStore },
    );
  }

  let instructions: string;
  try {
    instructions = `You are Penny, a warm family finance voice assistant. Always speak in English, including your opening greeting, even if the user speaks Danish. You have no direct financial function tools. Delegate every financial question and settings request to the client, which uses Claude Haiku and deterministic finance tools. Do not invent or recall financial figures. Wait for the client result supplied through thinking context, then explain it briefly. The application displays the complete answer and matching cards. Say hello briefly when the session starts.

The following context describes the household and tools available to the delegated assistant, not tools you can invoke yourself:
${voiceInstructions(parsed.data.snapshot, { mode: parsed.data.mode, notificationId: parsed.data.notificationId })}`;
  } catch {
    return Response.json({ error: "financial_data_unavailable" }, { status: 503, headers: noStore });
  }

  const session = await createAzureLiveSession(provider.config, instructions, parsed.data.sdp);
  if (!session.ok) return Response.json({ error: "upstream_error", message: session.message, status: session.status }, { status: 502, headers: noStore });
  return Response.json({ sdp: session.sdp, session_id: session.sessionId, model: provider.config.deployment, provider: "azure", transport: "webrtc" }, { headers: noStore });
}
