import { cacheLife } from "next/cache";
import { connection } from "next/server";
import snapshot from "@/data/offers.json";
import { fetchTjekOffers } from "@/lib/offers";
import { INGREDIENTS } from "@/lib/offers/meals";
import type { Offer } from "@/lib/types";

// Cached for ~1h (stale 5 min); a throw is not cached, so the next request retries live.
async function liveOffers(): Promise<Offer[]> {
  "use cache";
  cacheLife("hours");
  const offers = await fetchTjekOffers(INGREDIENTS, 4000);
  if (offers.length < 10) throw new Error("too few live offers");
  return offers;
}

export async function GET() {
  await connection(); // run per request, never prerender the snapshot fallback at build time
  try {
    const now = new Date().toISOString();
    const offers = (await liveOffers()).filter((o) => o.validTo >= now);
    return Response.json({ source: "live", offers });
  } catch {
    return Response.json({ source: "snapshot", offers: snapshot as Offer[] });
  }
}
