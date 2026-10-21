// Fake Nexi Smart Receipt partner API. Shape assumptions: docs/nexi.md.
import type { Receipt } from "@/lib/types";
import seed from "@/data/receipts.json";

/** A receipt as Nexi delivers it: no AI fields yet. */
export type NexiReceipt = Omit<Receipt, "category" | "aiNote">;

export interface NexiConsent {
  accessToken: string;
  scope: "receipts:read";
  expiresAt: string;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fake OAuth consent: always succeeds after a short delay. */
export async function connect(): Promise<NexiConsent> {
  await wait(1200);
  return {
    accessToken: `nexi_demo_${Math.random().toString(36).slice(2, 10)}`,
    scope: "receipts:read",
    expiresAt: new Date(Date.now() + 90 * 864e5).toISOString(),
  };
}

/** Fake `GET /v1/receipts` backfill. */
export async function fetchReceipts(): Promise<NexiReceipt[]> {
  await wait(800);
  return (seed as Receipt[]).map(({ id, merchant, chain, date, total, lines, source }) => ({ id, merchant, chain, date, total, lines, source }));
}

const line = (name: string, qty: number, price: number, kgPerUnit?: number) => ({ name, qty, price, ...(kgPerUnit ? { kgPerUnit } : {}) });

/** Receipts that "arrive" via the fake `receipt.created` webhook, in demo order. Totals = sum of lines. */
const INCOMING: Omit<NexiReceipt, "id" | "date" | "total" | "source">[] = [
  {
    merchant: "Netto Nørrebrogade",
    chain: "Netto",
    lines: [
      line("Hakket oksekød 8-12% 500 g", 1, 39.95, 0.5),
      line("Kartofler 2 kg", 1, 15, 2),
      line("Letmælk 1L", 3, 29.85, 1),
      line("Rugbrød", 1, 18, 1),
      line("Gulerødder 1 kg", 1, 9, 1),
      line("Bananer 1 kg", 1, 16, 1),
      line("Pasta penne 1 kg", 1, 13, 1),
      line("Hakkede tomater 400 g", 4, 18, 0.4),
      line("Skyr naturel 1 kg", 1, 20, 1),
      line("Ost Danbo 45+ 1 kg", 1, 35.2, 1),
    ],
  },
  {
    merchant: "Espresso House Strøget",
    chain: "Other",
    lines: [line("Caffe latte", 1, 48), line("Kanelsnegl", 1, 32)],
  },
  {
    merchant: "Wolt · Sushi Mania",
    chain: "Other",
    lines: [line("Sushi menu 24 stk", 1, 229), line("Edamame", 1, 39), line("Levering", 1, 29)],
  },
  {
    merchant: "Lidl Valby",
    chain: "Lidl",
    lines: [
      line("Kartofler 2,5 kg", 1, 15, 2.5),
      line("Linser røde 500 g", 2, 24, 0.5),
      line("Kålhoved", 1, 10, 1.2),
      line("Letmælk 1L", 3, 28.5, 1),
      line("Mandariner 1 kg", 1, 20, 1),
      line("Yoghurt græsk 1 kg", 1, 25, 1),
      line("Æg 10 stk", 1, 28, 0.6),
    ],
  },
  {
    merchant: "Fætter BR Fisketorvet",
    chain: "Other",
    lines: [line("Malebog", 1, 59), line("Farveblyanter 24 stk", 1, 49)],
  },
  {
    merchant: "Bilka Hundige",
    chain: "Bilka",
    lines: [
      line("Oksemørbrad 1 kg", 1, 299, 1),
      line("Laks fersk 1 kg", 1, 189, 1),
      line("Rejer 500 g", 2, 158, 0.5),
      line("Ost Gammel Knas 500 g", 1, 89, 0.5),
      line("Vin rødvin 75 cl", 3, 225, 0.75),
      line("Chokolade Anthon Berg", 1, 79, 0.4),
      line("Kaffe Merrild 500 g", 2, 90, 0.5),
      line("Juice appelsin 1 L", 4, 60, 1),
      line("Kyllingebryst 1 kg", 2, 158, 1),
      line("Bleer str. 4", 1, 89),
    ],
  },
];

/** Count of receipts that already came in live; drives which one is next. */
export const LIVE_PREFIX = "nx-live-";

/** Fake webhook: the next receipt in the demo pool, stamped now. Cycles through the pool. */
export function nextIncoming(existing: Pick<Receipt, "id">[], now = new Date()): NexiReceipt {
  const n = existing.filter((r) => r.id.startsWith(LIVE_PREFIX)).length;
  const t = INCOMING[n % INCOMING.length];
  return {
    ...t,
    id: `${LIVE_PREFIX}${now.getTime()}`,
    date: now.toISOString(),
    total: Math.round(t.lines.reduce((s, l) => s + l.price, 0) * 100) / 100,
    source: "nexi",
  };
}
