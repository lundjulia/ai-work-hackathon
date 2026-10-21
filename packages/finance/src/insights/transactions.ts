import type { Category, EnrichedTransaction, FinanceDataset, Holding, Transaction } from '../types.ts';
import { daysBetween, hashString, round2 } from '../util.ts';

export const transactionDay = (t: Transaction): string => t.status === 'booked' ? t.bookingDate ?? t.transactionDate : t.transactionDate;
export const merchantKey = (t: Transaction): string => (t.merchantName ?? t.counterpartyName ?? t.description ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replaceAll('æ','ae').replaceAll('ø','o').replaceAll('å','a').replace(/\b(?:visa|dankort|kob|bs|refund from)\b/g, '').replace(/\d{2}\.\d{2}|\d{4}-\d{2}-\d{2}/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** A missing conversion stays explicit; callers exclude it and warn, rather than inventing a rate. */
export function toDkk(amount: number, currency: string, dataset: FinanceDataset): number | undefined {
  if (!Number.isFinite(amount)) return undefined;
  if (currency === 'DKK') return round2(amount);
  const rates = dataset.fxRates.filter(r => r.valuationTime.slice(0, 10) <= dataset.asOf && r.rate > 0).sort((a,b) => b.valuationTime.localeCompare(a.valuationTime));
  const direct = rates.find(r => r.base === currency && r.quote === 'DKK');
  if (direct) return round2(amount * direct.rate);
  const inverse = rates.find(r => r.base === 'DKK' && r.quote === currency);
  if (inverse) return round2(amount / inverse.rate);
  return undefined;
}

const RULES: [RegExp, Category][] = [
  [/totalkredit|realkredit|faellesudgifter|e f valby|husleje|rent payment|bolig/, 'housing'],
  [/hiper|telmore|andel energi|electric|internet|vandforsyning/, 'utilities'],
  [/netflix|spotify|apple(?: com)?(?: bill)?|icloud|sats|disney|hbo|adobe/, 'subscriptions'],
  [/tryg|forsikring|insurance/, 'insurance'], [/kvik finans|afdrag|loan repayment/, 'debt'],
  [/netto|foetex|fotex|rema|lidl|aldi|superbrugsen|meny|irma|bilka|coop|supermarket/, 'groceries'],
  [/coffee|cafe|wolt|restaurant|madklubben|joe.*juice|saluhall|markthalle|hija.*sanchez|mikkeller|baest|gasoline grill|lagkagehuset|mcdonald|burger/, 'restaurants'],
  [/rejsekort|dsb|metro|bvg|shell|circle k|q8|taxi|uber|parkman|easypark/, 'transport'],
  [/matas|apotek|pharmacy|tand|dentist/, 'health'],
  [/zalando|elgiganten|normal|h&m|hm |magasin|ikea|jysk|dussmann|uniqlo/, 'shopping'],
  [/cinema|cinemax|nordisk film|ticketmaster|palads|biograf|museum/, 'entertainment'],
  [/hotel|airbnb|ryanair|sas airline|easyjet|booking com/, 'travel'],
  [/haeveautomat|atm withdrawal|cash withdrawal/, 'cash'],
];
const MCC: Record<string, Category> = { '5411':'groceries', '5499':'groceries', '5812':'restaurants', '5813':'restaurants', '5814':'restaurants', '4111':'transport', '4112':'transport', '4121':'transport', '5541':'transport', '5542':'transport', '5912':'health', '5977':'health', '8011':'health', '8021':'health', '5732':'shopping', '5651':'shopping', '5691':'shopping', '5311':'shopping', '5331':'shopping', '5942':'shopping', '7832':'entertainment', '7996':'entertainment', '7997':'subscriptions', '4899':'subscriptions', '7011':'travel' };
export function categorize(t: Transaction): Pick<EnrichedTransaction, 'category'|'categorySource'> {
  if (t.provider === 'saxo' || t.kind?.startsWith('investment_')) return {category:'investment',categorySource:'kind'};
  if (t.kind === 'salary') return {category:'income',categorySource:'kind'};
  if (t.kind === 'transfer' || t.kind === 'standing_order' || t.kind === 'fx_exchange') return {category:'transfer',categorySource:'kind'};
  if (t.kind === 'fee') return {category:'fees',categorySource:'kind'};
  const text = merchantKey(t);
  const rule = RULES.find(([pattern]) => pattern.test(text));
  if (rule) return {category:rule[1],categorySource:'rule'};
  if (t.mcc && MCC[t.mcc]) return {category:MCC[t.mcc]!,categorySource:'mcc'};
  return {category:'uncategorized',categorySource:'none'};
}

export interface ValuedTransaction extends EnrichedTransaction { valuationMissing?: boolean }

export function enrichTransactions(dataset: FinanceDataset): ValuedTransaction[] {
  const accountIds = new Set(dataset.accounts.map(a => a.id));
  const byId = new Map<string, Transaction>();
  for (const t of dataset.transactions) {
    if (!accountIds.has(t.accountId) || transactionDay(t) > dataset.asOf || t.transactionDate > dataset.asOf) continue;
    const old = byId.get(t.id);
    if (!old || t.retrievedAt > old.retrievedAt || (t.status === 'booked' && old.status === 'pending')) byId.set(t.id,t);
  }
  const raw = [...byId.values()].sort((a,b) => transactionDay(a).localeCompare(transactionDay(b)) || a.id.localeCompare(b.id));
  const replaced = new Set<string>();
  const replacements = new Map<string,string[]>();
  // One booked record replaces at most one reservation. Distinct booked IDs remain distinct possible charges.
  for (const booked of raw.filter(t => t.status === 'booked')) {
    const p = raw.find(t => t.status === 'pending' && !replaced.has(t.id) && t.accountId === booked.accountId && t.currency === booked.currency && t.amount === booked.amount && merchantKey(t) !== '' && merchantKey(t) === merchantKey(booked) && Math.abs(daysBetween(t.transactionDate, booked.transactionDate)) <= 3 && Math.abs(daysBetween(t.transactionDate, transactionDay(booked))) <= 7);
    if (p) { replaced.add(p.id); replacements.set(booked.id,[p.id]); }
  }
  const txs: ValuedTransaction[] = raw.filter(t => !replaced.has(t.id)).map(t => {
    const converted = toDkk(t.amount,t.currency,dataset);
    return {...t,...categorize(t),amountDkk:converted ?? 0,isInternalTransfer:false,...(converted === undefined ? {valuationMissing:true} : {}),...(replacements.has(t.id) ? {replacesPendingIds:replacements.get(t.id)} : {})};
  });
  const account = new Map(dataset.accounts.map(a => [a.id,a]));
  for (const debit of txs.filter(t => t.amountDkk < 0 && t.status === 'booked')) {
    if (debit.isInternalTransfer) continue;
    const a = account.get(debit.accountId);
    const credit = txs.find(c => c.amountDkk > 0 && c.status === 'booked' && !c.isInternalTransfer && c.accountId !== debit.accountId && Math.abs(c.amountDkk + debit.amountDkk) <= 1 && Math.abs(daysBetween(transactionDay(debit),transactionDay(c))) <= 3 && (
      (!!debit.exchangeGroupId && debit.exchangeGroupId === c.exchangeGroupId) ||
      (debit.category === 'transfer' && (c.category === 'transfer' || c.kind === 'investment_deposit')) ||
      (/revolut/.test(merchantKey(debit)) && c.kind === 'transfer') ||
      (!!debit.counterpartyAccount && debit.counterpartyAccount === account.get(c.accountId)?.maskedIdentifier) ||
      (!!c.counterpartyAccount && c.counterpartyAccount === a?.maskedIdentifier)
    ));
    if (credit) {
      const pair = `transfer:${hashString([debit.id,credit.id].sort().join('|'))}`;
      for (const t of [debit,credit]) { t.isInternalTransfer = true; t.transferPairId = pair; t.category='transfer'; t.categorySource='transfer'; }
    }
  }
  return txs;
}

export const isSpend = (t: EnrichedTransaction): boolean => !t.isInternalTransfer && !['income','transfer','investment'].includes(t.category) && (t.amountDkk < 0 || t.kind === 'refund');
export function netSpend(txs: readonly EnrichedTransaction[], category?: Category): number {
  return round2(-txs.filter(t => isSpend(t) && (!category || t.category === category)).reduce((n,t) => n+t.amountDkk,0));
}

/** A later valuation replaces the same account/instrument record; repeated retrievals do not add positions. */
export function visibleHoldings(dataset: FinanceDataset): Holding[] {
  const ids=new Set(dataset.accounts.map(a=>a.id));
  const byKey=new Map<string,Holding>();
  for(const h of dataset.holdings) {
    if(!ids.has(h.accountId)||h.valuationTime.slice(0,10)>dataset.asOf)continue;
    const key=`${h.accountId}|${h.instrument.isin??h.instrument.symbol}`;
    const previous=byKey.get(key);
    if(!previous||h.valuationTime>previous.valuationTime||(h.valuationTime===previous.valuationTime&&h.retrievedAt>previous.retrievedAt))byKey.set(key,h);
  }
  return [...byKey.values()].sort((a,b)=>a.accountId.localeCompare(b.accountId)||a.instrument.symbol.localeCompare(b.instrument.symbol));
}
