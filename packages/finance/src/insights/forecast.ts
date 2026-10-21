import type { Balance, FinanceDataset, Goals } from '../types.ts';
import type { CashForecast, RecurringPayment } from './types.ts';
import { addDays, addMonths, daysBetween, daysInMonth, eachDay, endOfMonth, hashString, lastBankingDayOfMonth, mean, median, monthKey, nextBankingDay, round2, startOfMonth } from '../util.ts';
import { enrichTransactions, isSpend, merchantKey, netSpend, toDkk, transactionDay } from './transactions.ts';

/** Select one balance per account and type. Never aggregate repeated retrievals. */
export function latestBalance(dataset: FinanceDataset, accountId: string, types: readonly Balance['type'][]): Balance | undefined {
  for (const type of types) {
    const b = dataset.balances.filter(b => b.accountId === accountId && b.type === type && b.referenceTime.slice(0,10) <= dataset.asOf).sort((a,b) => b.referenceTime.localeCompare(a.referenceTime) || b.retrievedAt.localeCompare(a.retrievedAt))[0];
    if (b) return b;
  }
  return undefined;
}
export function accountCashDkk(dataset: FinanceDataset, accountId: string, available = false): number | undefined {
  const b = latestBalance(dataset,accountId,available ? ['available','booked','investment_cash'] : ['booked','available','investment_cash']);
  return b ? toDkk(b.amount,b.currency,dataset) : undefined;
}

export function inferRecurring(dataset: FinanceDataset): RecurringPayment[] {
  const txs = enrichTransactions(dataset).filter(t => t.status === 'booked' && !t.valuationMissing && ((isSpend(t) && t.amountDkk < 0) || t.category === 'income'));
  const groups = new Map<string, typeof txs>();
  for (const t of txs) {
    const merchant = merchantKey(t);
    if (!merchant) continue;
    const key = `${t.accountId}|${merchant}|${t.category}`;
    const group = groups.get(key) ?? []; group.push(t); groups.set(key,group);
  }
  const out: RecurringPayment[] = [];
  for (const [key,group] of groups) {
    const monthly = new Map<string,typeof txs>();
    for (const t of group) { const m=monthKey(transactionDay(t));const g=monthly.get(m)??[];g.push(t);monthly.set(m,g); }
    // Monthly cadence needs one charge per month. Grocery/restaurant patterns are not inferred bills.
    if (monthly.size < 2 || [...monthly.values()].some(g => g.length !== 1)) continue;
    if (!['income','housing','utilities','insurance','debt','subscriptions'].includes(group[0]!.category)) continue;
    const ordered = [...group].sort((a,b) => transactionDay(a).localeCompare(transactionDay(b)));
    const recent = ordered.at(-1)!;
    const dates=ordered.map(transactionDay);
    const intervals=dates.slice(1).map((d,i) => daysBetween(dates[i]!,d));
    if (intervals.some(d => d < 25 || d > 36)) continue;
    let day = Math.round(median(dates.map(d=>Number(d.slice(8,10)))));
    if (recent.kind==='direct_debit') {
      const options=Array.from({length:31},(_,i)=>i+1).map(day=>({day,error:dates.reduce((n,date)=>n+Math.abs(daysBetween(nextBankingDay(`${monthKey(date)}-${String(Math.min(day,daysInMonth(date))).padStart(2,'0')}`),date)),0)}));
      day=options.sort((a,b)=>a.error-b.error||a.day-b.day)[0]!.day;
    }
    const monthEnd = dates.every(d=>Math.abs(daysBetween(d,lastBankingDayOfMonth(d)))<=2);
    const latestAmount=Math.abs(recent.amountDkk);
    const before=ordered.slice(0,-1).map(t=>Math.abs(t.amountDkk));
    const previousAmount=round2(median(before));
    out.push({id:`recurring:${hashString(key)}`,accountId:recent.accountId,name:recent.merchantName??recent.counterpartyName??recent.description??'Recurring payment',category:recent.category,type:recent.category==='income'?'salary':recent.category==='subscriptions'?'subscription':'bill',amountDkk:latestAmount,...(recent.category==='subscriptions' && Math.abs(latestAmount-previousAmount)>=1 ? {previousAmountDkk:previousAmount,changeDkk:round2(latestAmount-previousAmount)}:{}),lastDate:transactionDay(recent),dayOfMonth:day,bankingDayAdjusted:recent.kind==='direct_debit'||recent.kind==='salary',monthEnd,occurrences:ordered.length,estimated:true});
  }
  return out.sort((a,b)=>a.id.localeCompare(b.id));
}

export function recurringDate(payment: RecurringPayment, month: string): string {
  if (payment.monthEnd) return lastBankingDayOfMonth(`${month}-01`);
  const d = `${month}-${String(Math.min(payment.dayOfMonth,daysInMonth(`${month}-01`))).padStart(2,'0')}`;
  return payment.bankingDayAdjusted ? nextBankingDay(d) : d;
}

/** Completed calendar months only. A partial first or current month does not dilute proposals. */
export function historyMonths(dataset: FinanceDataset): string[] {
  const dates=enrichTransactions(dataset).filter(t=>t.status==='booked').map(transactionDay).sort();
  const first=dates[0]; if (!first) return [];
  const months:string[]=[];
  for(let m=startOfMonth(first); m<startOfMonth(dataset.asOf); m=addMonths(m,1)) {
    if(m>=first && endOfMonth(m)<dataset.asOf) months.push(monthKey(m));
  }
  return months.slice(-3);
}

export function generateForecast(dataset: FinanceDataset, goals: Goals, horizonDays?: number): CashForecast {
  const txs=enrichTransactions(dataset);
  const everyday=dataset.accounts.filter(a=>a.isEveryday && a.type!=='investment');
  const ids=new Set(everyday.map(a=>a.id));
  const warnings:string[]=[];
  let balance=0;
  for(const a of everyday) {
    const value=accountCashDkk(dataset,a.id,true); const b=latestBalance(dataset,a.id,['available','booked']);
    if(value===undefined) warnings.push(`Missing cash balance or FX rate for ${a.name}.`); else balance+=value;
    if(b?.stale || (b && daysBetween(b.referenceTime.slice(0,10),dataset.asOf)>2)) warnings.push(`Cash balance for ${a.name} is stale.`);
  }
  if(!everyday.length) warnings.push('No connected everyday account.');
  if(dataset.connections.some(c=>c.state!=='connected' && everyday.some(a=>a.connectionId===c.connectionId))) warnings.push('An everyday bank connection needs a refresh.');
  if(txs.some(t=>ids.has(t.accountId)&&t.valuationMissing)) warnings.push('Some spending has no usable FX rate.');
  const recurring=inferRecurring(dataset).filter(r=>ids.has(r.accountId));
  const salary=recurring.filter(r=>r.type==='salary').sort((a,b)=>b.amountDkk-a.amountDkk)[0];
  let nextPayday:string|null=null;
  if(salary) {
    let date=recurringDate(salary,monthKey(dataset.asOf));
    if(date<=dataset.asOf) date=recurringDate(salary,monthKey(addMonths(dataset.asOf,1)));
    nextPayday=date;
  } else warnings.push('No recurring salary inferred; future income is uncertain.');
  const daysToPayday=nextPayday ? daysBetween(dataset.asOf,nextPayday) : null;
  const requested=horizonDays??daysToPayday??30;
  const duration=Math.max(0,Math.min(90,Math.floor(Number.isFinite(requested)?requested:30)));
  if(requested>90) warnings.push('Forecast horizon capped at 90 days.');
  const horizonEnd=addDays(dataset.asOf,duration);
  const bills:CashForecast['bills']=[];
  const income=new Map<string,number>();
  const inferredIncome=recurring.filter(r=>r.type==='salary').reduce((n,r)=>n+r.amountDkk,0);
  for(let m=startOfMonth(dataset.asOf);m<=horizonEnd;m=addMonths(m,1)) {
    for(const r of recurring) {
      const date=recurringDate(r,monthKey(m));if(date<=dataset.asOf||date>horizonEnd)continue;
      if(r.type==='salary') income.set(date,(income.get(date)??0)+Math.max(0,goals.monthlyIncome ? goals.monthlyIncome*r.amountDkk/inferredIncome : r.amountDkk));
      else bills.push({id:`${r.id}:${date}`,name:r.name,date,amountDkk:r.amountDkk,estimated:true,accountId:r.accountId});
    }
  }
  // Recurring transfers to a non-everyday savings/investment account still reduce spendable cash.
  const outgoing=txs.filter(t=>t.status==='booked'&&ids.has(t.accountId)&&t.isInternalTransfer&&t.amountDkk<0&&txs.some(c=>c.transferPairId===t.transferPairId&&c.amountDkk>0&&!ids.has(c.accountId)));
  const transferGroups=new Map<string,typeof outgoing>();
  for(const t of outgoing) {const key=`${t.accountId}|${merchantKey(t)}`;const g=transferGroups.get(key)??[];g.push(t);transferGroups.set(key,g);}
  for(const [key,g] of transferGroups) {
    if(new Set(g.map(t=>monthKey(transactionDay(t)))).size<2)continue;
    const last=g.at(-1)!;const day=Math.min(...g.map(t=>Number(transactionDay(t).slice(8,10))));
    for(let m=startOfMonth(dataset.asOf);m<=horizonEnd;m=addMonths(m,1)) {
      const date=nextBankingDay(`${monthKey(m)}-${String(day).padStart(2,'0')}`);if(date<=dataset.asOf||date>horizonEnd)continue;
      bills.push({id:`saving:${hashString(key)}:${date}`,name:last.description??'Scheduled savings transfer',date,amountDkk:Math.abs(last.amountDkk),estimated:true,accountId:last.accountId});
    }
  }
  const months=historyMonths(dataset);
  const flexible=['groceries','restaurants','transport','shopping','health','entertainment','travel','cash','uncategorized','fees'] as const;
  const monthlyFlexible=flexible.reduce((n,c)=>{
    const past=months.map(m=>Math.max(0,netSpend(txs.filter(t=>ids.has(t.accountId)&&monthKey(transactionDay(t))===m),c)));
    return n+Math.max(goals.budgets[c]??0,mean(past));
  },0);
  const dailyDiscretionaryDkk=round2(monthlyFlexible/30.4375);
  // Booked balances need an explicit pending reserve; available balances already include it.
  for(const a of everyday) if(!latestBalance(dataset,a.id,['available'])) balance+=txs.filter(t=>t.accountId===a.id&&t.status==='pending'&&t.amountDkk<0).reduce((n,t)=>n+t.amountDkk,0);
  balance=round2(balance);
  const todayBalanceDkk=balance;
  const daily:CashForecast['daily']=[{date:dataset.asOf,balanceDkk:balance,beforeIncomeBalanceDkk:balance}];
  let minimum=balance;
  let projectedAtPaydayDkk:number|null=null;
  for(const date of eachDay(addDays(dataset.asOf,1),horizonEnd)) {
    balance=round2(balance-dailyDiscretionaryDkk-bills.filter(b=>b.date===date).reduce((n,b)=>n+b.amountDkk,0));
    // Preserve the pre-salary low point. Posting order on payday cannot make a transfer safe.
    minimum=Math.min(minimum,balance);
    const beforeIncomeBalanceDkk=balance;
    balance=round2(balance+(income.get(date)??0));
    if(date===nextPayday) projectedAtPaydayDkk=balance;
    daily.push({date,balanceDkk:balance,beforeIncomeBalanceDkk});
  }
  return {asOf:dataset.asOf,horizonEnd,todayBalanceDkk,nextPayday,daysToPayday,projectedAtPaydayDkk,minimumBalanceDkk:round2(minimum),bills:bills.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id)),daily,dailyDiscretionaryDkk,reliable:warnings.length===0,warnings};
}
