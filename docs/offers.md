# Offers (tilbudsaviser) & meal planning

Owner: worker-offers. Global requirements: [PRD.md](../PRD.md).

## Data source: Tjek / eTilbudsavis public API (works, no key) — verified 2026-10-21

- Search: `GET https://squid-api.tjek.com/v2/offers/search?query=<q>&dealer_ids=<ids>&limit=100` — no auth, JSON array.
- Dealer ids (DK, from `GET /v2/dealers?country_id=DK&limit=100&offset=0|100`): Netto `9ba51`, Bilka `93f13`, Føtex `bdf5A`, Rema 1000 `11deC`, Lidl `71c90`.
- Useful fields: `heading`, `description` (e.g. "Med 35 % grønt"), `pricing.price` (DKK per offer), `quantity.size.{from,to}` + `quantity.unit.symbol` (`g`, `kg`, `ml`, `cl`, `l`, `pcs`), `quantity.pieces.from` (multi-buy, "2 × 200 g for 46 kr"), `run_from`/`run_till`, `dealer_id`.
- Limits seen: max `limit=100` per call; search is fuzzy (e.g. "ris" returns grødris, "tarteletter" returns julefrokost menus); no hits for "havregryn"/"hvedemel" by query this week. Offers include current and next week's avis (run_from in the future). Undocumented/unofficial for third parties: treat as best effort, could rate-limit or change.
- Salling Group open API (developer.sallinggroup.com) covers Netto/Bilka/Føtex (food waste, stores, product suggestions) but needs an API key and has no Rema/Lidl; not used.

## Normalization (src/lib/offers/index.ts)

- kg = `size.from × unit factor × pieces.from` (litres count as kg; `pcs` only with a known piece weight: æg 60 g, broccoli 400 g, rugbrød 1 kg, agurk 350 g; otherwise dropped).
- Ranges ("600-1000 g") use the smallest size = the chain's printed "Pr. kg max", so kr/kg is conservative.
- Each offer is matched to an ingredient by include/exclude keywords (`INGREDIENTS` in `meals.ts`); `Offer.category` = ingredient id. Unmatched offers are dropped. Beef with "grønt" in the description gets "(med grønt)" and is excluded from plain beef.
- `pickOffers`: dedupe, then per ingredient keep each chain's best kr/kg plus the lowest pack price (so the UI can show "per item misleads").

## Snapshot vs live

- `src/data/offers.json`: **real** Tjek data fetched 2026-10-21 (60 offers, 15 ingredients, all 5 chains). Refresh: `cd apps/web && node src/lib/offers/snapshot.mjs`.
- `GET /api/offers` → `{ source: "live" | "snapshot", offers }`. Live = parallel Tjek searches (4 s timeout each), cached with `"use cache"` + `cacheLife("hours")`, expired offers filtered; any failure → snapshot. `/meals` renders the bundled snapshot instantly and swaps in the API result.
- Not on offer (ris, hvedemel, often mælk): meal costing uses `basePricePerKg` (hand-set normal shelf price, labelled "Not on offer · normal price" in the UI).

## Meals & "did we save?"

- 11 recipes, 4 servings, amounts in kg. Meal cost = Σ kg × cheapest kr/kg; savings vs the average kr/kg across that ingredient's offers.
- "Did we save?": receipt lines with `kgPerUnit` matched to ingredients by the same keywords; compares paid vs the same kg at each chain's best offer (lines a chain has no offer for keep the paid price). "This week" = receipts from the last 7 days, else the latest receipt.
- Plan this week: 5 cheapest dinners vs weekly food budget (`profile.budgets.food × 12 / 52`).

## Checks

- `cd apps/web && node src/lib/offers/offers.test.mjs` — unit normalization, 2-for-X multi-buy, 400 g vs 1 kg (cheaper per pack, dearer per kg), meal costing, basket by chain.
