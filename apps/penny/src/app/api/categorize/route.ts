import Anthropic from "@anthropic-ai/sdk";
import type { Category } from "@/lib/types";
import { CATEGORIES, categorizeByRules, type Categorized } from "@/lib/nexi/categorize";
import type { NexiReceipt } from "@/lib/nexi/client";

const MODEL = "claude-haiku-5-5"; // fast + cheap; this is a small classification call

type Input = Pick<NexiReceipt, "merchant" | "chain" | "total" | "lines">;

function parseInput(b: unknown): Input | null {
  if (!b || typeof b !== "object") return null;
  const r = b as Record<string, unknown>;
  if (typeof r.merchant !== "string" || typeof r.chain !== "string" || typeof r.total !== "number") return null;
  if (!Array.isArray(r.lines) || r.lines.length === 0 || r.lines.length > 200) return null;
  const linesOk = r.lines.every(
    (l) => l && typeof l.name === "string" && typeof l.qty === "number" && typeof l.price === "number",
  );
  return linesOk ? (r as unknown as Input) : null;
}

const SCHEMA = {
  type: "object",
  properties: {
    category: { type: "string", enum: CATEGORIES },
    lineCategories: { type: "array", items: { type: "string", enum: CATEGORIES } },
    aiNote: { type: "string" },
  },
  required: ["category", "lineCategories", "aiNote"],
  additionalProperties: false,
};

const SYSTEM = `You categorize Danish household receipts for a family budget app.
Categories: food (groceries, takeaway, household consumables bought at a supermarket), transport, home (furniture, decor, bills), kids (toys, nappies, kids' clothes), leisure (cinema, cafés, coffee shops, outings), other.
Return one category per line, in the same order, and the dominant category for the receipt by kr.
aiNote: one short, warm, plain-English sentence about where the money went (max 18 words). Never judge or scold; no investment advice.`;

async function categorizeWithClaude(r: Input): Promise<Categorized> {
  const client = new Anthropic();
  const msg = await client.messages.create(
    {
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM,
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content: JSON.stringify(r) }],
    },
    { timeout: 8000, maxRetries: 0 }, // demo must not hang; rules take over
  );
  const text = msg.content.find((b) => b.type === "text");
  if (msg.stop_reason !== "end_turn" || !text) throw new Error(`no usable output (${msg.stop_reason})`);
  const out = JSON.parse(text.text) as Categorized;
  const valid = (c: Category) => CATEGORIES.includes(c);
  if (!valid(out.category) || out.lineCategories.length !== r.lines.length || !out.lineCategories.every(valid)) {
    throw new Error("output failed validation");
  }
  return out;
}

export async function POST(request: Request) {
  const input = parseInput(await request.json().catch(() => null));
  if (!input) return Response.json({ error: "Expected a Nexi receipt: merchant, chain, total, lines[{name, qty, price}]" }, { status: 400 });

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return Response.json({ ...(await categorizeWithClaude(input)), source: "claude" });
    } catch (e) {
      console.error("categorize: Claude failed, using rules", e);
    }
  }
  return Response.json({ ...categorizeByRules(input), source: "rules" });
}
