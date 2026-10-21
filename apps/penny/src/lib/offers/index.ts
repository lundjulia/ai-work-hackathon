// Pure offer helpers: unit -> kg, Tjek normalization, cheapest-by-kr/kg, meal costing, basket comparison.
// Only `import type` here so node --experimental-strip-types can run the self-check without a bundler.
import type { Chain, Offer, Receipt } from "@/lib/types";

export type OfferChain = Offer["chain"];
export const CHAINS: OfferChain[] = ["Netto", "Bilka", "Føtex", "Rema 1000", "Lidl"];

/** Tjek (eTilbudsavis) dealer ids, DK. */
export const DEALER_IDS: Record<string, OfferChain> = {
  "9ba51": "Netto",
  "93f13": "Bilka",
  bdf5A: "Føtex",
  "11deC": "Rema 1000",
  "71c90": "Lidl",
};

export interface Ingredient {
  id: string;
  label: string;
  /** Tjek search query */
  query?: string;
  /** product name must contain one of these (lowercase) */
  include: string[];
  exclude?: string[];
  /** normal shelf price when nothing is on offer */
  basePricePerKg: number;
}

export interface Recipe {
  id: string;
  name: string;
  emoji: string;
  servings: number;
  items: { ingredient: string; kg: number }[];
}

// Approximate weight of one piece, for offers sold per "stk".
const STK_KG: [string, number][] = [
  ["æg", 0.06],
  ["broccoli", 0.4],
  ["rugbrød", 1],
  ["agurk", 0.35],
];

/** Pack size -> kg (litres count as kg). `stk` needs a known piece weight. Returns null if unknown. */
export function toKg(size: number, unit: string, product = ""): number | null {
  const u = unit.toLowerCase();
  const f: Record<string, number> = { g: 0.001, kg: 1, ml: 0.001, cl: 0.01, dl: 0.1, l: 1 };
  if (u in f) return size * f[u];
  if (u === "stk" || u === "pcs") {
    const p = product.toLowerCase();
    const hit = STK_KG.find(([k]) => p.includes(k));
    return hit ? size * hit[1] : null;
  }
  return null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function makeOffer(o: Omit<Offer, "pricePerKg">): Offer {
  return { ...o, kg: round2(o.kg * 1000) / 1000, pricePerKg: round2(o.price / o.kg) };
}

export function matches(name: string, ing: Ingredient): boolean {
  const n = name.toLowerCase();
  return ing.include.some((t) => n.includes(t)) && !(ing.exclude ?? []).some((t) => n.includes(t));
}

export const ingredientFor = (name: string, ingredients: Ingredient[]) => ingredients.find((i) => matches(name, i));

/* ---------- Tjek API ---------- */

export interface TjekOffer {
  heading: string;
  description?: string | null;
  pricing: { price: number };
  quantity: {
    unit: { symbol: string } | null;
    size: { from: number; to: number };
    pieces: { from: number; to: number };
  };
  run_from: string;
  run_till: string;
  dealer_id: string;
}

/** One Tjek offer -> Offer. Ranges ("600-1000 g") use the smallest size, i.e. the chain's printed "Pr. kg max". */
export function normalizeTjek(t: TjekOffer, ingredients: Ingredient[]): Offer | null {
  const chain = DEALER_IDS[t.dealer_id];
  const unit = t.quantity?.unit?.symbol;
  if (!chain || !unit || !t.pricing?.price) return null;
  let product = t.heading.trim();
  // shortcut: only flags the common "35 % grønt" beef blend hidden in the description; extend if other blends show up
  if (/grønt/i.test(t.description ?? "") && !/grønt/i.test(product)) product += " (med grønt)";
  const each = toKg(t.quantity.size.from, unit, product);
  if (!each) return null;
  const kg = each * Math.max(1, t.quantity.pieces?.from ?? 1); // multi-buy: "2 for 46 kr" -> price covers both packs
  const ing = ingredientFor(product, ingredients);
  if (!ing) return null;
  return makeOffer({
    chain,
    product,
    price: t.pricing.price,
    kg,
    validFrom: t.run_from,
    validTo: t.run_till,
    category: ing.id,
  });
}

export const TJEK_SEARCH = "https://squid-api.tjek.com/v2/offers/search";

export async function fetchTjekOffers(ingredients: Ingredient[], timeoutMs = 4000): Promise<Offer[]> {
  const dealers = Object.keys(DEALER_IDS).join(",");
  const queries = [...new Set(ingredients.map((i) => i.query).filter(Boolean))] as string[];
  const lists = await Promise.all(
    queries.map(async (q) => {
      const url = `${TJEK_SEARCH}?query=${encodeURIComponent(q)}&dealer_ids=${dealers}&limit=100`;
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) throw new Error(`tjek ${res.status}`);
      return (await res.json()) as TjekOffer[];
    }),
  );
  return pickOffers(lists.flat().map((t) => normalizeTjek(t, ingredients)).filter((o): o is Offer => !!o));
}

/** Dedupe, then keep per ingredient: best kr/kg per chain + the cheapest-per-pack offer (to show per-item misleads). */
export function pickOffers(all: Offer[]): Offer[] {
  const seen = new Set<string>();
  const uniq = all.filter((o) => {
    const k = `${o.chain}|${o.product}|${o.price}|${o.kg}`;
    return seen.has(k) ? false : (seen.add(k), true);
  });
  const keep = new Set<Offer>();
  for (const cat of new Set(uniq.map((o) => o.category))) {
    const group = uniq.filter((o) => o.category === cat);
    for (const c of CHAINS) {
      const best = cheapestByKg(group.filter((o) => o.chain === c));
      if (best) keep.add(best);
    }
    keep.add(group.reduce((a, b) => (b.price < a.price ? b : a)));
  }
  return uniq.filter((o) => keep.has(o));
}

/* ---------- comparisons ---------- */

export function cheapestByKg(offers: Offer[]): Offer | undefined {
  return offers.reduce<Offer | undefined>((a, b) => (!a || b.pricePerKg < a.pricePerKg ? b : a), undefined);
}

export const offersFor = (offers: Offer[], ingredientId: string, chain?: OfferChain) =>
  offers.filter((o) => o.category === ingredientId && (!chain || o.chain === chain));

export interface CostedItem {
  ingredient: Ingredient;
  kg: number;
  offer?: Offer; // undefined -> normal shelf price
  pricePerKg: number;
  avgPricePerKg: number;
  cost: number;
}

export interface CostedMeal {
  recipe: Recipe;
  items: CostedItem[];
  cost: number;
  perServing: number;
  avgCost: number;
  savings: number;
  chains: OfferChain[];
}

/** Cost = kg needed × cheapest kr/kg (any chain, or one chain). Savings vs the average kr/kg across offers. */
export function costMeal(recipe: Recipe, offers: Offer[], ingredients: Ingredient[], chain?: OfferChain): CostedMeal {
  const items = recipe.items.map(({ ingredient: id, kg }) => {
    const ingredient = ingredients.find((i) => i.id === id);
    if (!ingredient) throw new Error(`unknown ingredient ${id}`);
    const all = offersFor(offers, id);
    const offer = cheapestByKg(offersFor(offers, id, chain));
    const pricePerKg = offer?.pricePerKg ?? ingredient.basePricePerKg;
    const avgPricePerKg = all.length ? all.reduce((s, o) => s + o.pricePerKg, 0) / all.length : ingredient.basePricePerKg;
    return { ingredient, kg, offer, pricePerKg, avgPricePerKg, cost: kg * pricePerKg };
  });
  const cost = items.reduce((s, i) => s + i.cost, 0);
  const avgCost = items.reduce((s, i) => s + i.kg * i.avgPricePerKg, 0);
  const chains = [...new Set(items.flatMap((i) => (i.offer ? [i.offer.chain] : [])))];
  return { recipe, items, cost, perServing: cost / recipe.servings, avgCost, savings: Math.max(0, avgCost - cost), chains };
}

export const rankMeals = (recipes: Recipe[], offers: Offer[], ingredients: Ingredient[]) =>
  recipes.map((r) => costMeal(r, offers, ingredients)).sort((a, b) => a.perServing - b.perServing);

/* ---------- "did we save?" ---------- */

export interface BasketLine {
  name: string;
  chain: Chain;
  kg: number;
  paid: number;
  ingredient: Ingredient;
}

/** Receipt lines we can compare: known kg and a matching ingredient. */
export function basketLines(receipts: Receipt[], ingredients: Ingredient[]): BasketLine[] {
  return receipts.flatMap((r) =>
    r.lines.flatMap((l) => {
      const ingredient = ingredientFor(l.name, ingredients);
      if (!ingredient || !l.kgPerUnit) return [];
      return [{ name: l.name, chain: r.chain, kg: l.kgPerUnit * l.qty, paid: l.price, ingredient }];
    }),
  );
}

/** What the same basket would cost at each chain's best offer (lines without an offer keep what was paid). */
export function basketByChain(lines: BasketLine[], offers: Offer[]) {
  const paid = lines.reduce((s, l) => s + l.paid, 0);
  const chains = CHAINS.map((chain) => {
    const total = lines.reduce((s, l) => {
      const o = cheapestByKg(offersFor(offers, l.ingredient.id, chain));
      return s + (o ? l.kg * o.pricePerKg : l.paid);
    }, 0);
    return { chain, total };
  }).sort((a, b) => a.total - b.total);
  const avg = chains.reduce((s, c) => s + c.total, 0) / chains.length;
  return { paid, chains, avg };
}
