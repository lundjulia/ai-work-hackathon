import test from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNT_IDS, DEFAULT_GOALS, FIXTURE_SCENARIOS, FIXTURE_END, MORTGAGE, MORTGAGE_QUOTES, annuityPayment, amortizationSchedule, assignTransactionIds, calculateRefinancing, createFixtureConnectors, enrichTransactions, generateForecast, getSnapshot, historyMonths, inferRecurring, loadDemoDataset, mergeTransactions, netSpend, proposeGoals, recurringDate, toDkk } from '../src/index.ts';
import type { FinanceDataset, Transaction } from '../src/index.ts';

function tx(base:FinanceDataset,id:string,amount:number,date='2026-10-19',extras:Partial<Transaction>={}):Transaction {
  const a=base.accounts.find(a=>a.id===ACCOUNT_IDS.danskeEveryday)!;
  return {id,accountId:a.id,provider:a.provider,sourceAccountId:a.sourceAccountId,amount,currency:'DKK',status:'booked',bookingDate:date,transactionDate:date,retrievedAt:`${date}T20:00:00.000Z`,origin:'synthetic_fixture',...extras};
}
function emptyHistory(base:FinanceDataset):FinanceDataset{return {...structuredClone(base),transactions:[],liabilities:[],holdings:[],investmentEvents:[],mortgageQuotes:[]};}

const base=await loadDemoDataset();
test('combined valuation counts Saxo total once; repeated retrieval does not add money',()=>{
  const s=getSnapshot(base,DEFAULT_GOALS);
  assert.deepEqual(s.totals,{cashDkk:52744.57,investmentsDkk:95000,totalDkk:147744.57,complete:true});
  const duplicate={...base,transactions:[...base.transactions,...base.transactions],balances:[...base.balances,...base.balances],holdings:[...base.holdings,...base.holdings]};
  assert.deepEqual(getSnapshot(duplicate,DEFAULT_GOALS),s);
});
test('unknown merchant and person-to-person payments remain unknown; unseen MCC works',()=>{
  const d=emptyHistory(base);d.transactions=[tx(d,'unknown',-321,undefined,{description:'POS 98374',kind:'card_payment'}),tx(d,'mcc',-75,undefined,{merchantName:'Unfamiliar café',mcc:'5812'}),tx(d,'person',350,undefined,{description:'MobilePay to friend',kind:'mobilepay'})];
  const t=enrichTransactions(d);assert.equal(t.find(t=>t.id==='unknown')?.category,'uncategorized');assert.equal(t.find(t=>t.id==='person')?.category,'uncategorized');assert.equal(t.find(t=>t.id==='mcc')?.category,'restaurants');assert.equal(netSpend(t),396);
});
test('FX uses account amount, preserves original, and warns for missing or future rates',()=>{
  const s=getSnapshot(base,DEFAULT_GOALS);
  const sek=s.transactions.find(t=>t.originalAmount?.currency==='SEK')!;
  assert.equal(sek.originalAmount?.amount,-389);assert.equal(sek.amountDkk,sek.amount);assert.equal(sek.category,'restaurants');
  assert.equal(toDkk(-38.5,'EUR',base),-287.26);
  const d=emptyHistory(base);d.transactions=[tx(d,'usd',-50,undefined,{currency:'USD',merchantName:'Mystery market'})];
  d.fxRates=[{base:'USD',quote:'DKK',rate:6.8,valuationTime:'2026-10-20T12:00:00Z',source:'future',origin:'synthetic_fixture'}];
  const missing=getSnapshot(d,DEFAULT_GOALS);assert.equal(missing.transactions[0]?.valuationMissing,true);assert.equal(missing.totals.complete,false);assert.ok(missing.warnings.some(w=>w.includes('FX rate')));assert.equal(missing.surplus.amountDkk,0);
});
test('matched transfers and internal FX never become spending; cash movement event does not double count',()=>{
  const t=enrichTransactions(base);
  const transfer=t.filter(t=>t.transactionDate==='2026-10-09'&&Math.abs(t.amount)===1000);assert.equal(transfer.length,2);assert.ok(transfer.every(t=>t.isInternalTransfer));assert.equal(transfer[0]?.transferPairId,transfer[1]?.transferPairId);
  const fx=t.filter(t=>t.exchangeGroupId);assert.equal(fx.length,2);assert.ok(fx.every(t=>t.isInternalTransfer));
  const saxo=t.find(t=>t.kind==='investment_deposit')!;assert.equal(saxo.isInternalTransfer,true);
  assert.equal(netSpend([...transfer,...fx,saxo]),0);
});
test('one-sided card top-up is not arbitrarily paired with a similar payment',()=>{
  const d=emptyHistory(base);d.transactions=[tx(d,'out',-1000,undefined,{merchantName:'Unknown retailer',kind:'card_payment'}),tx(d,'in',1000,undefined,{accountId:ACCOUNT_IDS.revolutDkk,provider:'revolut',sourceAccountId:'rev',kind:'transfer'})];
  assert.ok(enrichTransactions(d).every(t=>!t.isInternalTransfer));assert.equal(netSpend(enrichTransactions(d)),1000);
});
test('refund offsets merchant spend without being salary',()=>{
  const t=enrichTransactions(base).filter(t=>t.merchantName==='Zalando');assert.ok(t.length>=2);assert.equal(netSpend(t,'shopping'),0);assert.ok(t.every(t=>t.category==='shopping'));
});
test('pending replacement with new ID keeps one purchase; distinct booked charges stay distinct',async()=>{
  const d=await loadDemoDataset('2026-10-20');const t=enrichTransactions(d).filter(t=>t.transactionDate==='2026-10-18'&&t.merchantName==='Matas');assert.equal(t.length,1);assert.equal(t[0]?.status,'booked');assert.equal(t[0]?.replacesPendingIds?.length,1);assert.equal(netSpend(t),249);
  const future=await loadDemoDataset('2026-10-22');const s=getSnapshot(future,DEFAULT_GOALS);const duplicate=s.candidates.find(c=>c.key.startsWith('possible-duplicate:'))!;assert.equal(duplicate.facts.count,2);assert.equal(duplicate.facts.chargeDkk,1299);assert.equal(duplicate.facts.totalDkk,2598);
});
test('same-date snapshot excludes injected future transactions, liabilities and quotes',async()=>{
  const all=await loadDemoDataset(FIXTURE_END);const injected={...base,transactions:[...base.transactions,...all.transactions.filter(t=>(t.bookingDate??t.transactionDate)>base.asOf)],mortgageQuotes:all.mortgageQuotes};
  injected.liabilities=[...base.liabilities,{...MORTGAGE,id:'future-liability',enteredAt:'2026-10-25T10:00:00Z'}];
  assert.deepEqual(getSnapshot(injected,DEFAULT_GOALS),getSnapshot(base,DEFAULT_GOALS));
});
test('loads and imported IDs are deterministic and idempotent',async()=>{
  assert.deepEqual(await loadDemoDataset(),await loadDemoDataset());
  const records=[tx(base,'x',-25,undefined,{sourceTransactionId:undefined}),tx(base,'y',-25,undefined,{sourceTransactionId:undefined})];
  const one=assignTransactionIds(records,'2026-10-19T20:00:00Z');const two=assignTransactionIds(records,'2026-10-20T20:00:00Z');assert.deepEqual(one.map(t=>t.id),two.map(t=>t.id));assert.notEqual(one[0]?.id,one[1]?.id);
  const merged=mergeTransactions(one,two,{accountIds:[ACCOUNT_IDS.danskeEveryday],from:'2026-10-01',to:'2026-10-31'});assert.equal(merged.length,2);
  const c=createFixtureConnectors({clock:()=>base.asOf})[0]!;assert.deepEqual(await c.getTransactions({from:'2026-08-01',to:base.asOf}),await c.getTransactions({from:'2026-08-01',to:base.asOf}));
});
test('auto budgets use full past months and work with a new scenario',()=>{
  assert.deepEqual(historyMonths(base),['2026-08','2026-09']);assert.equal(proposeGoals(base).monthlyIncome,34600);assert.equal(proposeGoals(base).budgets.restaurants,2500);
  const d=emptyHistory(base);d.asOf='2026-10-19';d.transactions=[tx(d,'start',-1,'2026-08-01',{mcc:'5411'}),tx(d,'food1',-899,'2026-08-15',{mcc:'5411'}),tx(d,'food2',-1100,'2026-09-15',{mcc:'5411'}),tx(d,'inc1',25000,'2026-08-14',{kind:'salary',counterpartyName:'NEW COMPANY'}),tx(d,'inc2',25000,'2026-09-14',{kind:'salary',counterpartyName:'NEW COMPANY'}),tx(d,'partial',-9000,'2026-10-18',{mcc:'5411'})];
  const p=proposeGoals(d);assert.equal(p.monthlyIncome,25000);assert.equal(p.budgets.groceries,1000);assert.equal(generateForecast(d,p).nextPayday,'2026-11-16');
});
test('forecast reserves pending once, inferred bills and pre-income low, and caps horizon',()=>{
  const f=generateForecast(base,DEFAULT_GOALS,40);assert.equal(f.todayBalanceDkk,21451);assert.equal(f.nextPayday,'2026-10-30');assert.ok(f.bills.some(b=>b.name.includes('Totalkredit')));assert.ok(f.bills.some(b=>b.name.includes('Valby')));
  const payday=f.daily.find(d=>d.date==='2026-10-30')!;assert.equal(roundDifference(payday.balanceDkk,payday.beforeIncomeBalanceDkk),34600);assert.ok(f.minimumBalanceDkk<=payday.beforeIncomeBalanceDkk);
  assert.equal(generateForecast(base,DEFAULT_GOALS,500).horizonEnd,'2027-01-17');assert.ok(generateForecast(base,DEFAULT_GOALS,500).warnings.some(w=>w.includes('capped')));
  const withoutAvailable={...base,balances:base.balances.filter(b=>b.type!=='available')};assert.equal(generateForecast(withoutAvailable,DEFAULT_GOALS).todayBalanceDkk,21451);
});
const roundDifference=(a:number,b:number)=>Math.round((a-b)*100)/100;
test('recurring bill day infers original date despite weekend shifts',()=>{
  const r=inferRecurring(base).find(r=>r.name==='Kvik Finans')!;assert.equal(r.dayOfMonth,25);assert.equal(recurringDate(r,'2026-11'),'2026-11-25');
});
test('expired consent keeps stale amounts, produces connection issue and blocks surplus',async()=>{
  const old=await loadDemoDataset('2026-10-24');const d=await loadDemoDataset('2026-10-26',FIXTURE_SCENARIOS.revolutConsentExpired);const s=getSnapshot(d,DEFAULT_GOALS);
  assert.equal(d.connections.find(c=>c.provider==='revolut')?.state,'consent_expired');assert.ok(d.balances.filter(b=>b.provider==='revolut').every(b=>b.stale));assert.deepEqual(d.transactions.filter(t=>t.provider==='revolut'),old.transactions.filter(t=>t.provider==='revolut'));assert.equal(s.surplus.amountDkk,0);assert.ok(s.candidates.some(c=>c.type==='connection_issue'));
  const partial=getSnapshot(await loadDemoDataset(base.asOf,FIXTURE_SCENARIOS.saxoUnavailable),DEFAULT_GOALS);assert.equal(partial.totals.investmentsDkk,0);assert.equal(partial.totals.complete,false);assert.equal(partial.risk.complete,false);
});
test('new duplicate finding, price change, budget crossing and refinancing emerge on time skip',async()=>{
  const start=getSnapshot(base,DEFAULT_GOALS);assert.ok(!start.candidates.some(c=>c.type==='refinancing'||c.type==='subscription_change'||c.key.includes(':restaurants:')));
  const later=getSnapshot(await loadDemoDataset('2026-10-26'),DEFAULT_GOALS);for(const type of ['anomaly','refinancing','subscription_change','budget_alert'])assert.ok(later.candidates.some(c=>c.type===type));
  const r=later.budgets.find(b=>b.category==='restaurants')!;assert.equal(r.spent,2287);assert.equal(r.daysLeft,5);
  const next=getSnapshot(await loadDemoDataset('2026-10-27'),DEFAULT_GOALS);for(const type of ['anomaly','refinancing','subscription_change'])assert.equal(later.candidates.find(c=>c.type===type)?.key,next.candidates.find(c=>c.type===type)?.key);
});
test('safe surplus is capped by forecast low, source cash and freshness; zero room never proposes a transfer',async()=>{
  const s=getSnapshot(await loadDemoDataset('2026-10-30'),DEFAULT_GOALS);assert.ok(s.surplus.amountDkk>=500);assert.ok(s.forecast.minimumBalanceDkk-s.surplus.amountDkk>=DEFAULT_GOALS.minimumBalance);assert.ok(s.candidates.some(c=>c.type==='transfer_suggestion'));
  assert.equal(getSnapshot(base,{...DEFAULT_GOALS,minimumBalance:100000}).surplus.amountDkk,0);
  const stale=structuredClone(base);stale.balances.filter(b=>b.accountId===ACCOUNT_IDS.danskeEveryday).forEach(b=>b.stale=true);assert.equal(getSnapshot(stale,DEFAULT_GOALS).surplus.amountDkk,0);
});
test('loan math amortizes zero interest and refinancing compares equal term after tax',()=>{
  assert.equal(annuityPayment(1200,0,12),100);const schedule=amortizationSchedule({balance:1200,annualRate:0,months:12});assert.equal(schedule.at(-1)?.closingBalance,0);
  const q=MORTGAGE_QUOTES.find(q=>q.date==='2026-10-26')!;const calc=calculateRefinancing(MORTGAGE,q)!;assert.equal(calc.newPrincipalDkk,2453074.19);assert.equal(calc.breakEvenMonths,40);assert.equal(calc.remainingTermMonths,MORTGAGE.remainingTermMonths);assert.ok(calc.netMonthlySavingDkk<calc.grossMonthlySavingDkk);assert.equal(calc.taxReliefPercent,25);
});
test('broad equity ETF is not treated as a single company; values and risk are deterministic',()=>{
  const s=getSnapshot(base,DEFAULT_GOALS);assert.equal(s.risk.largestHoldingName,'Novo Nordisk B');assert.equal(s.risk.largestHoldingPercent,36);assert.equal(s.risk.portfolioDkk,95000);
  assert.equal(new Set(s.candidates.map(c=>c.key)).size,s.candidates.length);for(const c of s.candidates){assert.ok(c.key&&c.rationale&&Object.keys(c.facts).length);for(const value of Object.values(c.facts))if(typeof value==='number')assert.ok(Number.isFinite(value));}
});

test('snapshot and proposal leave caller records untouched',()=>{
  const d=structuredClone(base),before=structuredClone(d),g=structuredClone(DEFAULT_GOALS),beforeGoals=structuredClone(g);
  getSnapshot(d,g);proposeGoals(d);generateForecast(d,g,60);assert.deepEqual(d,before);assert.deepEqual(g,beforeGoals);
});
test('missing investment cash split preserves known total and warns',()=>{
  const d={...base,balances:base.balances.filter(b=>!(b.accountId===ACCOUNT_IDS.saxo&&b.type==='investment_cash'))};
  const s=getSnapshot(d,DEFAULT_GOALS);assert.equal(s.totals.totalDkk,147744.57);assert.equal(s.totals.complete,false);assert.ok(s.warnings.some(w=>w.includes('split is unavailable')));
});

test('demo loader refuses dates beyond generated activity instead of inventing later bank data',async()=>{
  await assert.rejects(loadDemoDataset('2026-11-03'),/Synthetic activity ends/);
});
