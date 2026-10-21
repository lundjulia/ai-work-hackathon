// Self-check: `node src/lib/offers/offers.test.mjs` (from apps/web, Node >= 23 strips TS types natively).
import assert from "node:assert/strict";
import { toKg, normalizeTjek, cheapestByKg, makeOffer, costMeal, basketLines, basketByChain } from "./index.ts";
import { INGREDIENTS, RECIPES } from "./meals.ts";

// unit normalization
assert.equal(toKg(400, "g"), 0.4);
assert.equal(toKg(1.5, "kg"), 1.5);
assert.equal(toKg(500, "ml"), 0.5);
assert.equal(toKg(33, "cl"), 0.33);
assert.equal(toKg(1, "l"), 1);
assert.equal(toKg(10, "pcs", "Dava skrabeæg"), 0.6);
assert.equal(toKg(1, "stk", "Mystery item"), null);

const tjek = (heading, price, size, unit, pieces = 1, description = "") => ({
  heading, description, pricing: { price }, dealer_id: "9ba51",
  quantity: { unit: { symbol: unit }, size: { from: size, to: size }, pieces: { from: pieces, to: pieces } },
  run_from: "2026-10-20T00:00:00+0000", run_till: "2026-10-26T22:59:59+0000",
});

// 2-for-X multi-buy: "2 × 500 g pasta for 20 kr" = 1 kg -> 20 kr/kg, not 40
const multi = normalizeTjek(tjek("Pasta penne", 20, 500, "g", 2), INGREDIENTS);
assert.equal(multi.kg, 1);
assert.equal(multi.pricePerKg, 20);
assert.equal(multi.chain, "Netto");
assert.equal(multi.category, "pasta");

// hidden "med grønt" beef blend is flagged and not counted as plain beef
assert.equal(normalizeTjek(tjek("Hakket oksekød", 29.95, 400, "g", 1, "Med 35 % grønt."), INGREDIENTS), null);

// 400 g vs 1 kg: smaller pack is cheaper per item but dearer per kg
const small = makeOffer({ chain: "Netto", product: "Hakket oksekød 400 g", price: 35, kg: 0.4, validFrom: "", validTo: "", category: "oksekod" });
const big = makeOffer({ chain: "Lidl", product: "Hakket oksekød 1 kg", price: 79, kg: 1, validFrom: "", validTo: "", category: "oksekod" });
assert.ok(small.price < big.price);
assert.equal(small.pricePerKg, 87.5);
assert.equal(cheapestByKg([small, big]), big);

// meal costing uses kg × cheapest kr/kg, falls back to shelf price
const bolo = RECIPES.find((r) => r.id === "bolognese");
const meal = costMeal(bolo, [small, big], INGREDIENTS);
const beef = meal.items.find((i) => i.ingredient.id === "oksekod");
assert.equal(beef.cost, 0.5 * 79);
assert.equal(meal.items.find((i) => i.ingredient.id === "pasta").offer, undefined);
assert.ok(Math.abs(meal.perServing - meal.cost / 4) < 1e-9);
assert.deepEqual(meal.chains, ["Lidl"]);

// basket: paid 39.95 for 0.5 kg beef at Netto; Lidl offer is 79 kr/kg -> 39.50
const lines = basketLines([{ chain: "Netto", lines: [{ name: "Hakket oksekød 8-12%", qty: 1, kgPerUnit: 0.5, price: 39.95 }, { name: "Slik", qty: 1, price: 20 }] }], INGREDIENTS);
assert.equal(lines.length, 1);
const b = basketByChain(lines, [small, big]);
assert.equal(b.chains[0].chain, "Lidl");
assert.equal(b.chains[0].total, 39.5);

console.log("offers self-check: ok");
