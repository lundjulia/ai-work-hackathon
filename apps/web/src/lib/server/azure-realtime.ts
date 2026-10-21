/** Azure GA realtime configuration. Only this server module receives the resource API key. */
export type AzureRealtimeSettings = { endpoint?: string; deployment?: string; apiKey?: string };
export type AzureRealtimeConfig = { deployment: string; apiKey: string; secretsUrl: string; callsUrl: string };
export type AzureRealtimeConfigResult =
  | { ok: true; config: AzureRealtimeConfig }
  | { ok: false; error: "voice_not_configured" | "voice_configuration_invalid"; message: string; model: string | null };

export function azureRealtimeConfig(settings: AzureRealtimeSettings): AzureRealtimeConfigResult {
  const endpoint = settings.endpoint?.trim();
  const deployment = settings.deployment?.trim();
  const apiKey = settings.apiKey?.trim();
  const invalid = (message: string): AzureRealtimeConfigResult => ({ ok: false, error: "voice_configuration_invalid", message, model: deployment || null });
  if (endpoint) {
    let url: URL;
    try { url = new URL(endpoint); }
    catch { return invalid("AZURE_OPENAI_ENDPOINT must be an HTTPS Azure OpenAI resource URL."); }
    const path = url.pathname.replace(/\/+$/, "");
    if (
      url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash
      || !/^[a-z0-9][a-z0-9-]*\.(?:openai|services\.ai)\.azure\.com$/i.test(url.hostname)
      || (path !== "" && path !== "/openai/v1")
    ) return invalid("AZURE_OPENAI_ENDPOINT must be an HTTPS Azure OpenAI resource URL ending in /openai/v1 or the resource origin.");
  }
  if (deployment && !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(deployment)) {
    return invalid("AZURE_OPENAI_REALTIME_DEPLOYMENT must be a valid deployment name.");
  }
  if (apiKey && /\s/.test(apiKey)) return invalid("AZURE_OPENAI_API_KEY contains invalid whitespace.");
  if (!endpoint || !deployment || !apiKey) {
    const missing = [!endpoint && "AZURE_OPENAI_ENDPOINT", !deployment && "AZURE_OPENAI_REALTIME_DEPLOYMENT", !apiKey && "AZURE_OPENAI_API_KEY"].filter(Boolean).join(", ");
    return { ok: false, error: "voice_not_configured", message: `Voice not configured: ${missing} is not set on the server.`, model: deployment || null };
  }
  const base = `${new URL(endpoint).origin}/openai/v1/realtime`;
  return { ok: true, config: { deployment, apiKey, secretsUrl: `${base}/client_secrets`, callsUrl: `${base}/calls` } };
}

export type AzureRealtimeSecretResult =
  | { ok: true; value: string; expiresAt: number }
  | { ok: false; error: "upstream_unreachable" | "upstream_error"; message: string; status?: number };

/** Resource key uses api-key; the returned ephemeral value later uses Bearer for the SDP call. */
export async function createAzureRealtimeSecret(config: AzureRealtimeConfig, instructions: string, tools: unknown[], fetcher: typeof fetch = fetch): Promise<AzureRealtimeSecretResult> {
  let response: Response;
  try {
    response = await fetcher(config.secretsUrl, {
      method: "POST",
      headers: { "api-key": config.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        expires_after: { anchor: "created_at", seconds: 120 },
        session: {
          type: "realtime", model: config.deployment, instructions,
          output_modalities: ["audio"],
          audio: {
            input: {
              noise_reduction: { type: "near_field" },
              transcription: { model: "gpt-4o-mini-transcribe" },
              turn_detection: { type: "semantic_vad", eagerness: "medium" },
            },
            output: { voice: "marin" },
          },
          tools, tool_choice: "auto",
        },
      }),
      cache: "no-store", signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return { ok: false, error: "upstream_unreachable", message: "Azure OpenAI could not be reached. Try again." };
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    let message = detail;
    try {
      const parsed: unknown = JSON.parse(detail);
      if (typeof parsed === "object" && parsed !== null && "error" in parsed) {
        const error = parsed.error;
        if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") message = error.message;
      }
    } catch { /* Non-JSON Azure errors still provide a bounded message. */ }
    // Never assume an upstream error cannot echo credentials.
    message = message.replaceAll(config.apiKey, "[redacted]").slice(0, 500);
    return { ok: false, error: "upstream_error", status: response.status, message: message || "Azure OpenAI rejected the voice session." };
  }
  const data: unknown = await response.json().catch(() => null);
  if (
    typeof data !== "object" || data === null || !("value" in data) || !("expires_at" in data)
    || typeof data.value !== "string" || !data.value || data.value === config.apiKey
    || typeof data.expires_at !== "number" || !Number.isFinite(data.expires_at) || data.expires_at <= Date.now() / 1_000
  ) return { ok: false, error: "upstream_error", message: "Azure OpenAI returned no valid client secret." };
  return { ok: true, value: data.value, expiresAt: data.expires_at };
}
