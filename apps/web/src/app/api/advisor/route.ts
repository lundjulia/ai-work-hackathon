import Anthropic from "@anthropic-ai/sdk";
import {
  fallbackReply,
  MAX_MESSAGE_CHARS,
  MAX_MESSAGES,
  type AdvisorContext,
  type ChatMessage,
} from "@/lib/advisor";

const SYSTEM = `You are "Penny", a cheerful mustard-yellow character and the family's AI money coach inside a family budget app. You are openly an AI.
Personality: warm, funny, encouraging, never judging or shaming. Plain language a busy parent understands; no finance jargon.
Keep answers short: 2-5 sentences or a few bullets. Use concrete kr amounts from the family data below. Write in the user's language (Danish or English).

You help the family:
- define financial goals: savings goal, monthly amount, income, budgets, risk tolerance, safety net
- manage financial risk: build a safety net first, plan for irregular expenses (car, dentist, yearly bills)
- understand spending: where the money went, smart alerts when a budget is running hot, auto-budget suggestions, insights on receipts
- accept feedback and commitments, e.g. "No coffee this week"

HARD RULE: Never recommend specific investments, funds, stocks, bonds, crypto, banks or financial products, and never say whether to buy or sell anything. If asked, kindly say you don't pick investments, then explain what is possible to save each month, general concepts (safety net first, what their risk tolerance means), and that the family decides (a bank adviser can help with specifics).

Pledges: when the user commits to something (e.g. "No candy this week!"), cheer them on, and end your reply with one final line exactly like:
PLEDGE: <short pledge text, max 60 characters>
Only add that line when the user commits to something.`;


function bad(msg: string) {
  return Response.json({ error: msg }, { status: 400 });
}

function parse(body: unknown): { messages: ChatMessage[]; context: AdvisorContext } | string {
  if (!body || typeof body !== "object") return "Body must be JSON";
  const { messages, context } = body as { messages?: unknown; context?: unknown };
  if (!Array.isArray(messages) || messages.length === 0) return "messages required";
  const clean: ChatMessage[] = [];
  for (const m of messages.slice(-MAX_MESSAGES)) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") return "bad message";
    const content = m.content.trim().slice(0, MAX_MESSAGE_CHARS);
    if (content) clean.push({ role: m.role, content });
  }
  // API needs the conversation to start and end with the user.
  while (clean[0]?.role === "assistant") clean.shift();
  if (clean.at(-1)?.role !== "user") return "last message must be from the user";
  if (!context || typeof context !== "object") return "context required";
  const ctx = context as AdvisorContext;
  if (typeof ctx.income !== "number" || !ctx.goal || !ctx.budgets || !ctx.spentThisMonth || !ctx.safetyNet)
    return "context incomplete";
  if (JSON.stringify(ctx).length > 8000) return "context too large";
  return { messages: clean, context: ctx };
}

async function* claudeText(messages: ChatMessage[], context: AdvisorContext) {
  const stream = new Anthropic().beta.messages.stream({
    model: "claude-opus-5-5",
    max_tokens: 8000,
    output_config: { effort: "low" },
    // Server-side refusal fallback (Opus 5.5 default per Anthropic guidance).
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [
      { type: "text", text: SYSTEM },
      { type: "text", text: `Family data (DKK, this month):\n${JSON.stringify(context)}` },
    ],
    messages,
  });
  for await (const ev of stream) {
    if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") yield ev.delta.text;
  }
}

async function* fallbackText(messages: ChatMessage[], context: AdvisorContext) {
  // Word-by-word with a small delay so the offline coach still "types" live.
  for (const word of fallbackReply(messages, context).split(/(?<=\s)/)) {
    yield word;
    await new Promise((r) => setTimeout(r, 30));
  }
}

export async function POST(req: Request) {
  const parsed = parse(await req.json().catch(() => null));
  if (typeof parsed === "string") return bad(parsed);
  const { messages, context } = parsed;
  const enc = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let sent = false;
      try {
        if (!process.env.ANTHROPIC_API_KEY) throw new Error("no key");
        for await (const t of claudeText(messages, context)) {
          sent = true;
          controller.enqueue(enc.encode(t));
        }
        if (!sent) throw new Error("empty reply");
      } catch (err) {
        if (process.env.ANTHROPIC_API_KEY) console.error("advisor: Claude failed, using fallback", err);
        if (sent) controller.enqueue(enc.encode("\n\n(Oops, I lost my train of thought. Try asking again!)"));
        else for await (const t of fallbackText(messages, context)) controller.enqueue(enc.encode(t));
      }
      controller.close();
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
