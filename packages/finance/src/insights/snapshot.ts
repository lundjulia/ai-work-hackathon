import type { ActionCandidate, Category, FinanceDataset, Goals } from '../types.ts';
import type { FinanceSnapshot } from './types.ts';
import { addDays, ceilTo, daysBetween, daysInMonth, floorTo, hashString, mean, median, monthKey, round2, roundTo } from '../util.ts';
import { enrichTransactions, isSpend, merchantKey, netSpend, toDkk, transactionDay, visibleHoldings } from './transactions.ts';
import { accountCashDkk, generateForecast, historyMonths, inferRecurring, latestBalance } from './forecast.ts';
import { financingCandidates } from './financing.ts';

const ESSENTIAL:Category[]=['housing','utilities','groceries','transport','insurance','debt','health'];
const VARIABLE:Category[]=['groceries','restaurants','transport','shopping','health','entertainment','travel'];
export function proposeGoals(dataset: FinanceDataset): Goals {
  const txs=enrichTransactions(dataset),months=historyMonths(dataset);
  const budgets:Goals['budgets']={};
  for(const c of VARIABLE) {
    const values=months.map(m=>Math.max(0,netSpend(txs.filter(t=>monthKey(transactionDay(t))===m),c)));
    const average=mean(values);
    if(average>0) budgets[c]=Math.max(100,roundTo(average*(c==='restaurants'?0.9:1),100));
  }
  const inferred=inferRecurring(dataset);
  const subscriptions=inferred.filter(r=>r.type==='subscription').reduce((n,r)=>n+r.amountDkk,0);
  if(subscriptions>0)budgets.subscriptions=round2(subscriptions);
  const salary=inferred.filter(r=>r.type==='salary');
  const income=round2(salary.reduce((n,r)=>n+r.amountDkk,0));
  const savings=dataset.accounts.find(a=>a.type==='savings');
  return {riskTolerance:'moderate',monthlyIncome:income,budgets,safetyNet:{months:3,...(savings?{accountId:savings.id}:{})},minimumBalance:income>0?ceilTo(income*0.25,1000):5000};
}

export function getSnapshot(dataset: FinanceDataset, goals: Goals): FinanceSnapshot {
  const txs=enrichTransactions(dataset),recurring=inferRecurring(dataset),months=historyMonths(dataset);
  const candidates:ActionCandidate[]=[];const warnings:string[]=[];
  let cashDkk=0,investmentsDkk=0,complete=true;
  for(const a of dataset.accounts) {
    const b=latestBalance(dataset,a.id,a.type==='investment'?['investment_total']:['booked','available']);
    let value=b?toDkk(b.amount,b.currency,dataset):undefined;
    if(a.type==='investment'&&value===undefined) {
      const cash=accountCashDkk(dataset,a.id);
      const positionBalance=latestBalance(dataset,a.id,['investment_positions']);
      const holdings=visibleHoldings(dataset).filter(h=>h.accountId===a.id);
      const positions=positionBalance?toDkk(positionBalance.amount,positionBalance.currency,dataset):holdings.length?holdings.reduce((n,h)=>n+(toDkk(h.marketValue,h.accountCurrency,dataset)??0),0):undefined;
      if(cash!==undefined&&positions!==undefined)value=cash+positions;
    }
    if(value===undefined) {complete=false;warnings.push(`Missing balance or valuation for ${a.name}.`);} else if(a.type==='investment') {
      const investmentCash=accountCashDkk(dataset,a.id);
      if(investmentCash!==undefined) {cashDkk+=investmentCash;investmentsDkk+=value-investmentCash;}
      else {investmentsDkk+=value;complete=false;warnings.push(`${a.name} cash/position split is unavailable; total value is shown under investments.`);}
    } else cashDkk+=value;
    if(b?.stale)warnings.push(`${a.name} is showing its last successful balance.`);
    if(a.type==='investment'&&b&&daysBetween(b.referenceTime.slice(0,10),dataset.asOf)>3)warnings.push(`${a.name} uses an earlier investment valuation.`);
  }
  const unknown=txs.filter(t=>t.category==='uncategorized'&&t.amountDkk<0);
  if(unknown.length)warnings.push(`${unknown.length} payments have an unknown spending category.`);
  if(txs.some(t=>t.valuationMissing)){warnings.push('Some foreign-currency payments are excluded because an FX rate is unavailable.');complete=false;}
  if(dataset.holdings.some(h=>daysBetween(h.valuationTime.slice(0,10),dataset.asOf)>3))warnings.push('Investment prices use an earlier valuation; market values may have changed.');
  for(const c of dataset.connections.filter(c=>c.state!=='connected')) {
    complete=false;
    candidates.push({key:`connection:${c.connectionId}:${c.state}:${c.consentExpiresAt??c.lastSuccessfulRetrievalAt??'unknown'}`,type:'connection_issue',title:`Refresh ${c.provider.replaceAll('_',' ')} connection`,body:c.message??'The bank data could not be refreshed.',accounts:dataset.accounts.filter(a=>a.connectionId===c.connectionId).map(a=>a.id),severity:'high',rationale:'Keep previously retrieved records with their retrieval time. Never treat missing data as zero.',triggeredOn:dataset.asOf,facts:{provider:c.provider,state:c.state,lastSuccessfulRetrievalAt:c.lastSuccessfulRetrievalAt??null,stale:true}});
  }
  const month=monthKey(dataset.asOf),elapsed=Number(dataset.asOf.slice(8,10)),daysLeft=daysInMonth(dataset.asOf)-elapsed;
  const current=txs.filter(t=>monthKey(transactionDay(t))===month);
  const budgets=Object.entries(goals.budgets).map(([category,budget])=>{
    const c=category as Category,b=Math.max(0,budget??0),spent=round2(netSpend(current,c));
    const pace=b>0?spent/b:spent>0?1:0;
    const result={category:c,spent,budget:b,remaining:round2(b-spent),pace,daysLeft,projected:round2(spent/elapsed*daysInMonth(dataset.asOf))};
    if((b>0&&pace>=0.8&&daysLeft>=3)||(spent>b&&spent>0)) {
      const state=spent>b?'over':'near';
      let cumulative=0;let triggeredOn=dataset.asOf;
      for(const t of current.filter(t=>t.category===c&&isSpend(t)).sort((a,b)=>transactionDay(a).localeCompare(transactionDay(b))||a.id.localeCompare(b.id))) {
        cumulative-=t.amountDkk;
        if((state==='over'?cumulative>b:cumulative>=b*0.8)){triggeredOn=transactionDay(t);break;}
      }
      candidates.push({key:`budget:${month}:${c}:${state}`,type:'budget_alert',title:spent>b?`${c} budget exceeded`:`${c} budget is getting close`,body:`You have spent DKK ${spent} of DKK ${b}, with ${daysLeft} days left this month.`,amount:spent,severity:spent>b?'high':'medium',rationale:'Net categorized spending, including open reservations and refunds; internal transfers and investment cash movements are excluded.',triggeredOn,facts:{category:c,spentDkk:spent,budgetDkk:b,remainingDkk:result.remaining,percentUsed:round2(pace*100),daysLeft,projectedMonthSpendDkk:result.projected,month}});
    }
    return result;
  });
  for(const r of recurring.filter(r=>r.type==='subscription'&&(r.changeDkk??0)>0)) {
    candidates.push({key:`subscription:${r.id}:${r.previousAmountDkk}:${r.amountDkk}`,type:'subscription_change',title:`${r.name} subscription increased`,body:`The latest charge is DKK ${r.amountDkk}, up from DKK ${r.previousAmountDkk}.`,amount:r.changeDkk,severity:'low',rationale:'Repeated monthly merchant charges support this inference. A changed charge could also reflect a plan change.',triggeredOn:r.lastDate,accounts:[r.accountId],facts:{merchant:r.name,previousAmountDkk:r.previousAmountDkk!,amountDkk:r.amountDkk,increaseDkk:r.changeDkk!,annualIncreaseDkk:round2(r.changeDkk!*12),estimated:true}});
  }
  const recent=txs.filter(t=>t.status==='booked'&&t.amountDkk<0&&isSpend(t)&&transactionDay(t)>=addDays(dataset.asOf,-30));
  const groups=new Map<string,typeof recent>();
  for(const t of recent){const key=`${t.accountId}|${transactionDay(t)}|${merchantKey(t)}|${t.amountDkk}`;const group=groups.get(key)??[];group.push(t);groups.set(key,group);}
  for(const [key,g] of groups) {
    if(g.length<2||!merchantKey(g[0]!))continue;
    const t=g[0]!;
    candidates.push({key:`possible-duplicate:${hashString(key)}`,type:'anomaly',title:`Check repeated ${t.merchantName??'card'} charges`,body:`There are ${g.length} booked charges of DKK ${Math.abs(t.amountDkk)} on ${transactionDay(t)}.`,amount:Math.abs(t.amountDkk),accounts:[t.accountId],severity:'medium',rationale:'Distinct transaction IDs are preserved. Matching merchant, amount and day suggest checking receipts, not automatically reversing a charge.',triggeredOn:transactionDay(t),facts:{merchant:t.merchantName??t.description??'Unknown merchant',chargeDkk:Math.abs(t.amountDkk),count:g.length,totalDkk:round2(Math.abs(t.amountDkk)*g.length),date:transactionDay(t),estimated:true}});
  }
  // Large unfamiliar charges are review prompts, not fraud claims.
  for(const t of recent.filter(t=>Math.abs(t.amountDkk)>=1500)) {
    const history=txs.filter(p=>transactionDay(p)<transactionDay(t)&&isSpend(p)&&p.amountDkk<0&&p.category===t.category&&!p.isInternalTransfer);
    const baseline=median(history.map(p=>Math.abs(p.amountDkk)));
    const seen=history.some(p=>merchantKey(p)===merchantKey(t));
    if(!seen&&history.length>=5&&Math.abs(t.amountDkk)>baseline*3) candidates.push({key:`large-unfamiliar:${t.id}`,type:'anomaly',title:'Review an unfamiliar large payment',body:`A DKK ${Math.abs(t.amountDkk)} payment is much larger than your usual ${t.category} payment.`,amount:Math.abs(t.amountDkk),accounts:[t.accountId],severity:'medium',rationale:'At least five past payments in this category form the baseline. This flags a payment for review and does not diagnose fraud.',triggeredOn:transactionDay(t),facts:{transactionId:t.id,amountDkk:Math.abs(t.amountDkk),category:t.category,medianPaymentDkk:round2(baseline),merchant:t.merchantName??t.description??'Unknown merchant'}});
  }
  const monthlyEssentialsDkk=round2(ESSENTIAL.reduce((n,c)=>{
    const observed=mean(months.map(m=>Math.max(0,netSpend(txs.filter(t=>monthKey(transactionDay(t))===m),c))));
    const fixed=recurring.filter(r=>r.category===c&&r.type!=='salary').reduce((n,r)=>n+r.amountDkk,0);
    return n+Math.max(observed,fixed,goals.budgets[c]??0);
  },0));
  const bufferAccounts=goals.safetyNet.accountId?dataset.accounts.filter(a=>a.id===goals.safetyNet.accountId):dataset.accounts.filter(a=>a.type==='savings');
  const bufferDkk=round2(bufferAccounts.reduce((n,a)=>n+Math.max(0,accountCashDkk(dataset,a.id,true)??0),0));
  const targetDkk=round2(Math.max(0,goals.safetyNet.targetAmount??goals.safetyNet.months*monthlyEssentialsDkk));
  const safetyNet={months:monthlyEssentialsDkk>0?round2(bufferDkk/monthlyEssentialsDkk):0,monthlyEssentialsDkk,bufferDkk,targetDkk,gapDkk:round2(Math.max(0,targetDkk-bufferDkk)),estimated:true as const};
  if(safetyNet.gapDkk>0&&monthlyEssentialsDkk>0)candidates.push({key:`safety-net:${goals.safetyNet.accountId??'savings'}:${goals.safetyNet.months}:${goals.safetyNet.targetAmount??'derived'}`,type:'safety_net',title:'Build up your safety net',body:`Your buffer covers ${safetyNet.months} months of essential spending. The target is DKK ${targetDkk}.`,amount:safetyNet.gapDkk,severity:'medium',rationale:'Essential spending is the greater of completed-month averages, inferred bills and accepted essential budgets. Investments are excluded from the emergency buffer.',triggeredOn:dataset.asOf,facts:{months:safetyNet.months,monthlyEssentialsDkk,bufferDkk,targetDkk,gapDkk:safetyNet.gapDkk,targetMonths:goals.safetyNet.months,estimated:true}});
  const forecast=generateForecast(dataset,goals);
  warnings.push(...forecast.warnings);
  const destination=dataset.accounts.find(a=>a.id===goals.safetyNet.accountId&&a.type==='savings')??dataset.accounts.find(a=>a.type==='savings');
  const healthy=(id:string)=>{const a=dataset.accounts.find(a=>a.id===id);const b=latestBalance(dataset,id,['available','booked']);return !!a&&!!b&&!b.stale&&daysBetween(b.referenceTime.slice(0,10),dataset.asOf)<=2&&dataset.connections.some(c=>c.connectionId===a.connectionId&&c.state==='connected');};
  const source=dataset.accounts.filter(a=>a.isEveryday&&a.type==='current'&&a.currency==='DKK'&&healthy(a.id)).sort((a,b)=>(accountCashDkk(dataset,b.id,true)??0)-(accountCashDkk(dataset,a.id,true)??0))[0];
  const surplusReliable=forecast.reliable&&!!destination&&healthy(destination.id)&&destination.currency==='DKK'&&!!source;
  const sourceRoom=source?Math.max(0,(accountCashDkk(dataset,source.id,true)??0)-Math.max(0,goals.minimumBalance)):0;
  const surplusAmount=surplusReliable?Math.max(0,floorTo(Math.min(sourceRoom,forecast.minimumBalanceDkk-Math.max(0,goals.minimumBalance)),100)):0;
  const surplus={amountDkk:surplusAmount,...(source?{fromAccountId:source.id}:{}),...(destination?{toAccountId:destination.id}:{}),reliable:surplusReliable};
  if(surplusAmount>=500&&source&&destination)candidates.push({key:`surplus:${source.id}:${destination.id}:${month}:${surplusAmount}`,type:'transfer_suggestion',title:'Move spare cash to your buffer',body:`You can move DKK ${surplusAmount} to savings while keeping at least DKK ${Math.max(0,goals.minimumBalance)} in forecast everyday cash.`,amount:surplusAmount,accounts:[source.id,destination.id],severity:'low',rationale:'Uses available cash, pending reservations, inferred bills, scheduled savings and the greater of historic or budgeted flexible spend. The lowest pre-salary balance sets the limit. Proposed transfer only.',triggeredOn:dataset.asOf,facts:{amountDkk:surplusAmount,fromAccountId:source.id,toAccountId:destination.id,minimumBalanceDkk:goals.minimumBalance,projectedMinimumAfterTransferDkk:round2(forecast.minimumBalanceDkk-surplusAmount),daysToPayday:forecast.daysToPayday,estimated:true}});
  const holdings=visibleHoldings(dataset);
  const values=holdings.map(h=>({h,value:toDkk(h.marketValue,h.accountCurrency,dataset)??0}));
  const portfolioDkk=round2(values.reduce((n,v)=>n+v.value,0));
  const largest=[...values].filter(v=>v.h.instrument.assetClass==='equity').sort((a,b)=>b.value-a.value)[0];
  const costKnown=holdings.length>0&&holdings.every(h=>h.costBasis!==undefined);
  const cost=costKnown?round2(holdings.reduce((n,h)=>n+(toDkk(h.costBasis!,h.accountCurrency,dataset)??0),0)):0;
  const risk={portfolioDkk,equityPercent:portfolioDkk?round2(values.filter(v=>['equity','equity_fund'].includes(v.h.instrument.assetClass)).reduce((n,v)=>n+v.value,0)/portfolioDkk*100):0,largestHoldingPercent:largest&&portfolioDkk?round2(largest.value/portfolioDkk*100):0,largestHoldingName:largest?.h.instrument.name??null,homeBiasPercent:portfolioDkk?round2(values.filter(v=>v.h.instrument.country==='DK'&&v.h.instrument.assetClass==='equity').reduce((n,v)=>n+v.value,0)/portfolioDkk*100):0,unrealizedPnlDkk:costKnown?round2(portfolioDkk-cost):null,costBasisDrawdownPercent:costKnown&&cost>0?round2(Math.max(0,(cost-portfolioDkk)/cost*100)):null,tolerance:goals.riskTolerance,complete:holdings.length>0&&values.every(v=>toDkk(v.h.marketValue,v.h.accountCurrency,dataset)!==undefined)&&dataset.accounts.filter(a=>a.type==='investment').every(a=>dataset.connections.some(c=>c.connectionId===a.connectionId&&c.state==='connected'))};
  const concentrationLimit={low:15,moderate:25,high:40}[goals.riskTolerance],equityLimit={low:40,moderate:80,high:100}[goals.riskTolerance];
  if(risk.complete&&(risk.largestHoldingPercent>concentrationLimit||risk.equityPercent>equityLimit))candidates.push({key:`risk:${[...new Set(holdings.map(h=>h.accountId))].sort().join(',')}:${goals.riskTolerance}:${largest?.h.instrument.symbol??'allocation'}`,type:'risk_check',title:'Review investment concentration',body:`${risk.largestHoldingName??'The largest stock'} is ${risk.largestHoldingPercent}% of invested positions; equities are ${risk.equityPercent}%.`,severity:'medium',rationale:'Portfolio values exclude cash. Broad global equity funds are not treated as single-company holdings. Thresholds are illustrative product rules for the chosen risk tolerance; no live investment recommendation.',triggeredOn:dataset.asOf,facts:{portfolioDkk,largestHoldingName:risk.largestHoldingName,largestHoldingPercent:risk.largestHoldingPercent,equityPercent:risk.equityPercent,concentrationLimitPercent:concentrationLimit,equityLimitPercent:equityLimit,homeBiasPercent:risk.homeBiasPercent,tolerance:goals.riskTolerance}});
  candidates.push(...financingCandidates(dataset));
  return {asOf:dataset.asOf,transactions:txs,totals:{cashDkk:round2(cashDkk),investmentsDkk:round2(investmentsDkk),totalDkk:round2(cashDkk+investmentsDkk),complete},budgets,recurring,forecast,safetyNet,surplus,risk,candidates:candidates.sort((a,b)=>a.key.localeCompare(b.key)),warnings:[...new Set(warnings)]};
}
