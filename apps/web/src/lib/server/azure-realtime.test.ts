import assert from "node:assert/strict";
import { test } from "node:test";

import { azureRealtimeConfig, createAzureRealtimeSecret } from "./azure-realtime";

const endpoint = "https://j-hckthn-impact-resource.openai.azure.com/openai/v1";
const settings = { endpoint, deployment: "gpt-live-1", apiKey: "test-resource-secret" };
const configResult = azureRealtimeConfig(settings);
if (!configResult.ok) throw new Error("Invalid test configuration");
const config = configResult.config;

test("Azure GA endpoint normalization never duplicates /openai/v1", () => {
  for (const value of [endpoint, `${endpoint}/`, `${endpoint}///`, new URL(endpoint).origin]) {
    const result = azureRealtimeConfig({ ...settings, endpoint: value });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.config.secretsUrl, `${endpoint}/realtime/client_secrets`);
    assert.equal(result.config.callsUrl, `${endpoint}/realtime/calls`);
    assert.equal(result.config.deployment, "gpt-live-1");
  }
});

test("Azure Foundry services hostname normalizes to the same v1 realtime paths", () => {
  const origin = "https://j-hckthn-impact-resource.services.ai.azure.com";
  for (const endpoint of [origin, `${origin}/openai/v1/`]) {
    const result = azureRealtimeConfig({ ...settings, endpoint });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.config.secretsUrl, `${origin}/openai/v1/realtime/client_secrets`);
    assert.equal(result.config.callsUrl, `${origin}/openai/v1/realtime/calls`);
  }
});

test("missing credentials and unsafe endpoint/deployment settings are explicit", () => {
  for (const missing of [{ endpoint: undefined }, { deployment: undefined }, { apiKey: undefined }]) {
    const result = azureRealtimeConfig({ ...settings, ...missing });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, "voice_not_configured");
  }
  for (const value of ["http://resource.openai.azure.com", "https://api.openai.com/v1", `${endpoint}?api-version=preview`, `${endpoint}#fragment`, `${endpoint}/realtimeapi/sessions`, "https://user:secret@resource.openai.azure.com", "https://resource.openai.azure.com:8080"]) {
    const result = azureRealtimeConfig({ ...settings, endpoint: value });
    assert.equal(result.ok, false, value);
    if (!result.ok) assert.equal(result.error, "voice_configuration_invalid");
  }
  assert.equal(azureRealtimeConfig({ ...settings, deployment: "model/path" }).ok, false);
  assert.equal(azureRealtimeConfig({ ...settings, apiKey: "key\nheader" }).ok, false);
});

test("Azure client-secret request uses resource api-key, GA config and the deployment", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json({ value: "ephemeral-test", expires_at: Math.floor(Date.now() / 1_000) + 120 });
  };
  const tools = [{ type: "function", name: "get_overview", parameters: { type: "object" } }];
  const secret = await createAzureRealtimeSecret(config, "Read tool figures", tools, fetcher);
  assert.equal(secret.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, `${endpoint}/realtime/client_secrets`);
  const init = calls[0]?.init;
  assert.equal(init?.method, "POST");
  const headers = new Headers(init?.headers);
  assert.equal(headers.get("api-key"), settings.apiKey);
  assert.equal(headers.has("Authorization"), false);
  assert.equal(headers.has("OpenAI-Beta"), false);
  const body = JSON.parse(String(init?.body));
  assert.deepEqual(body.expires_after, { anchor: "created_at", seconds: 120 });
  assert.equal(body.session.type, "realtime");
  assert.equal(body.session.model, "gpt-live-1");
  assert.equal(body.session.instructions, "Read tool figures");
  assert.deepEqual(body.session.tools, tools);
  assert.equal(body.session.audio.output.voice, "marin");
  assert.equal(body.session.audio.input.turn_detection.type, "semantic_vad");
  assert.equal(init?.cache, "no-store");
  assert.ok(init?.signal);
  assert.ok(!JSON.stringify(secret).includes(settings.apiKey));
});

test("Azure errors preserve status, bound messages and redact resource keys", async () => {
  const error = await createAzureRealtimeSecret(config, "", [], async () => Response.json({ error: { message: `Invalid deployment ${settings.apiKey} ${"x".repeat(900)}` } }, { status: 404 }));
  assert.equal(error.ok, false);
  if (error.ok) return;
  assert.equal(error.error, "upstream_error");
  assert.equal(error.status, 404);
  assert.ok(error.message.includes("[redacted]"));
  assert.ok(!error.message.includes(settings.apiKey));
  assert.equal(error.message.length, 500);
});

test("unreachable Azure and malformed or expired secrets never become successful sessions", async () => {
  const unreachable = await createAzureRealtimeSecret(config, "", [], async () => { throw new TypeError("network"); });
  assert.equal(unreachable.ok, false);
  if (!unreachable.ok) assert.equal(unreachable.error, "upstream_unreachable");
  for (const data of [null, { value: "", expires_at: Date.now() }, { value: "ephemeral", expires_at: 1 }, { value: config.apiKey, expires_at: Date.now() }, { value: "ephemeral", expires_at: "tomorrow" }]) {
    assert.equal((await createAzureRealtimeSecret(config, "", [], async () => Response.json(data))).ok, false);
  }
  assert.equal((await createAzureRealtimeSecret(config, "", [], async () => new Response("not JSON"))).ok, false);
});
