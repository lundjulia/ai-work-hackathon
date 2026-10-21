import type { AzureRealtimeConfig } from "./azure-realtime";

export const LIVE_SDP_MAX_BYTES = 65_536;
export function plausibleLiveSdp(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("v=0") && new TextEncoder().encode(value).length <= LIVE_SDP_MAX_BYTES
    && /^m=audio /m.test(value) && /^m=application /m.test(value);
}
export type AzureLiveResult = { ok: true; sdp: string; sessionId: string } | { ok: false; status?: number; message: string };

/** GPT-Live uses an authenticated SDP exchange, never a client secret. */
export async function createAzureLiveSession(config: AzureRealtimeConfig, instructions: string, sdp: string, fetcher: typeof fetch = fetch): Promise<AzureLiveResult> {
  if (!plausibleLiveSdp(sdp)) return { ok: false, message: "Invalid browser SDP offer." };
  let response: Response;
  try {
    response = await fetcher(`${new URL(config.callsUrl).origin}/openai/v1/live/sessions`, {
      method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20_000),
      headers: { "api-key": config.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ session: { model: config.deployment, instructions, audio: { output: { voice: "marin" } }, delegation: { type: "client" } }, transport: { type: "webrtc", sdp } }),
    });
  } catch { return { ok: false, message: "Azure voice could not be reached." }; }
  const text = await response.text();
  if (new TextEncoder().encode(text).length > 262_144) return { ok: false, message: "Azure returned too much session data." };
  let data: { session?: { id?: unknown; model?: unknown }; transport?: { sdp?: unknown }; error?: { message?: unknown } };
  try { data = JSON.parse(text); } catch { return { ok: false, message: "Azure returned an invalid session." }; }
  if (!response.ok) return { ok: false, status: response.status, message: typeof data.error?.message === "string" ? data.error.message.replaceAll(config.apiKey, "[redacted]").slice(0, 500) : "Azure rejected the voice session." };
  if (typeof data.session?.id !== "string" || !data.session.id || !plausibleLiveSdp(data.transport?.sdp)
    || data.transport.sdp.includes(config.apiKey) || data.session.id.includes(config.apiKey)
    || (data.session.model !== undefined && data.session.model !== config.deployment)) return { ok: false, message: "Azure returned an invalid session answer." };
  return { ok: true, sdp: data.transport.sdp, sessionId: data.session.id };
}
