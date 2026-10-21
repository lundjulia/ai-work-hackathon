import { z } from "zod";

import { ENV } from "../../env.server";
import { DEMO_SNAPSHOT_MAX_BYTES, persistedDemoStateSchema } from "../demo-state-schema";
import { hasVoiceNotification, voiceArtifactSchema, type VoiceArtifact } from "../voice-artifacts";
import { runVoiceTool, voiceInstructions, voiceToolDefinitions } from "../voice-tools";
import { DemoError } from "./demo-errors";

export const ASSISTANT_CHAT_MODEL = "claude-haiku-5-5";
export const ASSISTANT_CHAT_MAX_BYTES = DEMO_SNAPSHOT_MAX_BYTES + 100_000;
export const ASSISTANT_CHAT_MAX_ROUNDS = 4;
const PROVIDER_MAX_BYTES = 131_072;

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(2_000),
}).strict();

/** History contains conversation text only. Every request supplies the current browser snapshot. */
export const assistantChatRequestSchema = z.object({
  snapshot: persistedDemoStateSchema,
  mode: z.enum(["onboarding", "assistant"]).optional(),
  notificationId: z.string().min(1).max(200).optional(),
  messages: z.array(messageSchema).min(1).max(24),
}).strict().superRefine((input, context) => {
  if (input.messages.reduce((total, message) => total + message.content.length, 0) > 24_000) {
    context.addIssue({ code: "custom", message: "Conversation history is too long." });
  }
  if (input.messages.some((message, index) => message.role !== (index % 2 === 0 ? "user" : "assistant")) || input.messages.at(-1)?.role !== "user") {
    context.addIssue({ code: "custom", message: "Messages must alternate, starting and ending with the user." });
  }
  if (!hasVoiceNotification(input.snapshot, input.notificationId)) {
    context.addIssue({ code: "custom", message: "That notification is no longer available." });
  }
});

export type AssistantChatRequest = z.infer<typeof assistantChatRequestSchema>;
export type AssistantChatResponse = { text: string; artifacts: VoiceArtifact[] };

const contentBlockSchema = z.discriminatedUnion("type", [
  // Haiku may return signed reasoning even without a request-level thinking option.
  // Preserve it for provider continuation; only text blocks become the visible reply.
  z.object({ type: z.literal("thinking"), thinking: z.string().max(64_000), signature: z.string().min(1).max(64_000) }),
  z.object({ type: z.literal("redacted_thinking"), data: z.string().min(1).max(64_000) }),
  z.object({ type: z.literal("text"), text: z.string().max(16_000) }),
  z.object({
    type: z.literal("tool_use"), id: z.string().min(1).max(200),
    name: z.string().min(1).max(80), input: z.record(z.string(), z.unknown()),
  }),
]);
const providerMessageSchema = z.object({
  content: z.array(contentBlockSchema).min(1).max(8),
  stop_reason: z.enum(["end_turn", "tool_use"]),
});
type ProviderBlock = z.infer<typeof contentBlockSchema>;
type ToolResultBlock = { type: "tool_result"; tool_use_id: string; content: string };
type ProviderMessage = { role: "user" | "assistant"; content: string | (ProviderBlock | ToolResultBlock)[] };

function unavailable(message = "The assistant could not finish. Please try again.") {
  return new DemoError("assistant_unavailable", message, 502);
}

async function readProviderJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw unavailable();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > PROVIDER_MAX_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw unavailable("The assistant returned too much data. Please try again.");
      }
      chunks.push(value);
    }
    const body = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(body));
  } catch {
    throw unavailable("The assistant returned an unreadable response. Please try again.");
  } finally {
    reader.releaseLock();
  }
}

/**
 * Typed fallback for the primary voice assistant. Reuses its instructions and validated tools.
 * All tool calls read one validated snapshot; proposal artifacts require a later browser save.
 */
export async function assistantChat(
  input: AssistantChatRequest,
  options: { fetcher?: typeof fetch; apiKey?: string } = {},
): Promise<AssistantChatResponse> {
  const parsed = assistantChatRequestSchema.safeParse(input);
  if (!parsed.success) throw new DemoError("invalid_chat_request", "Send a valid financial snapshot and a short conversation.");
  const apiKey = (options.apiKey ?? ENV.ANTHROPIC_API_KEY)?.trim();
  if (!apiKey) throw new DemoError("assistant_not_configured", "Text chat is unavailable until the server has its Claude API key.", 503);
  const fetcher = options.fetcher ?? fetch;
  const signal = AbortSignal.timeout(45_000);
  const messages: ProviderMessage[] = parsed.data.messages.map((message) => ({ ...message }));
  const artifacts: VoiceArtifact[] = [];
  const seenToolIds = new Set<string>();
  const system = voiceInstructions(parsed.data.snapshot, { mode: parsed.data.mode, notificationId: parsed.data.notificationId });
  const tools = voiceToolDefinitions(parsed.data.mode ?? "assistant").map(({ name, description, parameters }) => ({ name, description, input_schema: parameters }));

  for (let round = 0; round < ASSISTANT_CHAT_MAX_ROUNDS; round++) {
    if (signal.aborted) throw unavailable();
    let response: Response;
    try {
      response = await fetcher("https://api.anthropic.com/v1/messages", {
        method: "POST", cache: "no-store", signal,
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({ model: ASSISTANT_CHAT_MODEL, max_tokens: 1_024, system, messages, tools }),
      });
    } catch { throw unavailable(); }
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw unavailable(`The assistant could not connect to Claude (HTTP ${response.status}). Please try again.`);
    }
    const generated = providerMessageSchema.safeParse(await readProviderJson(response));
    if (!generated.success) throw unavailable("The assistant returned an incomplete response. Please try again.");
    const calls = generated.data.content.filter((block) => block.type === "tool_use");
    if (!calls.length) {
      const text = generated.data.content.filter((block) => block.type === "text").map((block) => block.text).join("\n").trim();
      if (generated.data.stop_reason !== "end_turn" || !text || text.length > 4_000) throw unavailable();
      return { text, artifacts };
    }
    if (generated.data.stop_reason !== "tool_use" || calls.length > 4 || round === ASSISTANT_CHAT_MAX_ROUNDS - 1) {
      throw unavailable("The assistant could not finish its checks. Please try a shorter question.");
    }
    const results: ToolResultBlock[] = [];
    for (const call of calls) {
      if (signal.aborted || seenToolIds.has(call.id)) throw unavailable();
      seenToolIds.add(call.id);
      let result: Awaited<ReturnType<typeof runVoiceTool>>;
      try { result = await runVoiceTool(call.name, call.input, parsed.data.snapshot, { mode: parsed.data.mode, notificationId: parsed.data.notificationId }); }
      catch { throw unavailable("Your financial information could not be read. Please try again."); }
      if (!result.ok) throw unavailable("The assistant requested an invalid financial check. Please try again.");
      if (result.artifact !== undefined) {
        const artifact = voiceArtifactSchema.safeParse(result.artifact);
        if (!artifact.success) throw unavailable("The assistant returned an invalid card. Please try again.");
        artifacts.push(artifact.data);
      }
      results.push({ type: "tool_result", tool_use_id: call.id, content: JSON.stringify(result) });
    }
    messages.push({ role: "assistant", content: generated.data.content }, { role: "user", content: results });
  }
  throw unavailable();
}
