// Refresh src/data/offers.json from the live Tjek API: `node src/lib/offers/snapshot.mjs` (run from apps/web, Node >= 23).
import { writeFileSync } from "node:fs";
import { fetchTjekOffers } from "./index.ts";
import { INGREDIENTS } from "./meals.ts";

const offers = await fetchTjekOffers(INGREDIENTS, 10000);
writeFileSync(new URL("../../data/offers.json", import.meta.url), JSON.stringify(offers, null, 1) + "\n");
console.log(`wrote ${offers.length} offers`);
