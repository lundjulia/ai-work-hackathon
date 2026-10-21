/**
 * Import-boundary helpers shared by all connectors (fixture or real):
 * deterministic IDs for records without a provider ID, and merging newly
 * retrieved transactions into stored history.
 */
import type { ISODateTime, Transaction } from "../types.ts";
import { hashString } from "../util.ts";

type IdInput = Omit<Transaction, "id" | "retrievedAt">;

/**
 * Assigns app IDs. Provider ID when present; otherwise a content hash plus an
 * occurrence counter so two identical ID-less lines on the same day stay distinct.
 */
export function assignTransactionIds<T extends IdInput>(records: readonly T[], retrievedAt: ISODateTime): (T & Pick<Transaction, "id" | "retrievedAt">)[] {
  const seen = new Map<string, number>();
  return records.map((r) => {
    let id: string;
    if (r.sourceTransactionId) {
      id = `${r.provider}:${r.sourceAccountId}:${r.sourceTransactionId}`;
    } else {
      const content = [r.provider, r.sourceAccountId, r.status, r.bookingDate ?? r.transactionDate, r.amount, r.currency, r.description ?? "", r.counterpartyName ?? ""].join("|");
      const n = (seen.get(content) ?? 0) + 1;
      seen.set(content, n);
      id = `${r.provider}:${r.sourceAccountId}:h${hashString(content)}-${n}`;
    }
    return { ...r, id, retrievedAt };
  });
}

/**
 * Merge a fresh retrieval into stored history (storage-agnostic upsert by ID).
 * Pending records not present in the fresh retrieval for the same account and
 * covered date range are dropped, since providers stop returning a reservation
 * once it books or is released. Pending/booked pairs with different IDs are
 * handled later by `dedupePending`.
 */
export function mergeTransactions(
  stored: readonly Transaction[],
  incoming: readonly Transaction[],
  covered: { accountIds: readonly string[]; from: string; to: string },
): Transaction[] {
  const byId = new Map<string, Transaction>();
  const incomingIds = new Set(incoming.map((t) => t.id));
  const coveredAccounts = new Set(covered.accountIds);
  for (const t of stored) {
    const inCoveredWindow =
      coveredAccounts.has(t.accountId) && t.transactionDate >= covered.from && t.transactionDate <= covered.to;
    if (t.status === "pending" && inCoveredWindow && !incomingIds.has(t.id)) continue;
    byId.set(t.id, t);
  }
  for (const t of incoming) byId.set(t.id, t);
  return [...byId.values()];
}
