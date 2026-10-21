import type { ActionCandidate, FinanceDataset, MortgageBondQuote, MortgageLiability } from '../types.ts';
import { amortizationSchedule } from './loan-math.ts';
import { ceilTo, round2 } from '../util.ts';

/** Illustrative scenario parameters. No rate or tax outcome is a live offer. */
export const FINANCING_ASSUMPTIONS = {
  taxReliefRate: 0.25,
  fixedRegistrationFeeDkk: 1825,
  variableRegistrationRate: 0.0125,
  lenderAndSettlementFeesDkk: 12000,
  mortgageAssessmentMonths: 60,
  consolidationAnnualRate: 0.079,
  consolidationSetupFeeDkk: 1000,
} as const;

export function calculateRefinancing(loan: MortgageLiability, quote: MortgageBondQuote) {
  if(loan.currency!=='DKK'||loan.rateType!=='fixed'||quote.rateType!=='fixed'||quote.couponRate>=loan.couponRate||quote.price<=0) return null;
  const a=FINANCING_ASSUMPTIONS;
  // Callable fixed-rate loan assumed redeemed at par at a permitted settlement date.
  const redemptionDkk=loan.balance*Math.min(1,(loan.bondPrice??100)/100);
  let feesDkk=a.lenderAndSettlementFeesDkk+a.fixedRegistrationFeeDkk;
  let newPrincipalDkk=(redemptionDkk+feesDkk)/(quote.price/100);
  for(let i=0;i<8;i++) {
    const registrationVariable=ceilTo(Math.max(0,newPrincipalDkk-(loan.registeredPledgeAmount??0))*a.variableRegistrationRate,100);
    feesDkk=a.lenderAndSettlementFeesDkk+a.fixedRegistrationFeeDkk+registrationVariable;
    newPrincipalDkk=(redemptionDkk+feesDkk)/(quote.price/100);
  }
  const old=amortizationSchedule({balance:loan.balance,annualRate:loan.couponRate,months:loan.remainingTermMonths,contributionRate:loan.contributionRate});
  const replacement=amortizationSchedule({balance:newPrincipalDkk,annualRate:quote.couponRate,months:loan.remainingTermMonths,contributionRate:quote.contributionRate});
  const firstOld=old[0],firstNew=replacement[0]; if(!firstOld||!firstNew)return null;
  const grossMonthlySavingDkk=firstOld.payment-firstNew.payment;
  const oldTaxBenefit=(firstOld.interest+firstOld.contribution)*a.taxReliefRate;
  const newTaxBenefit=(firstNew.interest+firstNew.contribution)*a.taxReliefRate;
  const netMonthlySavingDkk=grossMonthlySavingDkk-(oldTaxBenefit-newTaxBenefit);
  // Compare after-tax payments and remaining debt over equal horizons, including financed fees/kurs loss.
  let cumulative=0;let breakEvenMonths:number|null=null;
  for(let i=0;i<Math.min(old.length,replacement.length);i++) {
    const x=old[i]!,y=replacement[i]!;
    cumulative+=(x.payment-(x.interest+x.contribution)*a.taxReliefRate)-(y.payment-(y.interest+y.contribution)*a.taxReliefRate);
    if(cumulative+x.closingBalance-y.closingBalance>=0){breakEvenMonths=i+1;break;}
  }
  return {redemptionDkk:round2(redemptionDkk),feesDkk:round2(feesDkk),newPrincipalDkk:round2(newPrincipalDkk),additionalDebtDkk:round2(newPrincipalDkk-loan.balance),grossMonthlySavingDkk:round2(grossMonthlySavingDkk),netMonthlySavingDkk:round2(netMonthlySavingDkk),reducedTaxReliefMonthlyDkk:round2(oldTaxBenefit-newTaxBenefit),breakEvenMonths,quotePrice:quote.price,oldCouponPercent:loan.couponRate*100,newCouponPercent:quote.couponRate*100,taxReliefPercent:a.taxReliefRate*100,remainingTermMonths:loan.remainingTermMonths};
}

export function financingCandidates(dataset: FinanceDataset): ActionCandidate[] {
  const out:ActionCandidate[]=[];
  const visible=dataset.liabilities.filter(l=>l.enteredAt.slice(0,10)<=dataset.asOf);
  const latest=new Map<string,MortgageBondQuote>();
  for(const q of dataset.mortgageQuotes.filter(q=>q.date<=dataset.asOf).sort((a,b)=>a.date.localeCompare(b.date)))latest.set(q.bondName,q);
  for(const loan of visible) {
    if(loan.kind==='mortgage') {
      const eligible=[...latest.values()].map(q=>({q,result:calculateRefinancing(loan,q)})).filter(x=>x.result&&x.result.netMonthlySavingDkk>0&&x.result.breakEvenMonths!==null&&x.result.breakEvenMonths<=FINANCING_ASSUMPTIONS.mortgageAssessmentMonths).sort((a,b)=>a.result!.breakEvenMonths!-b.result!.breakEvenMonths!)[0];
      if(eligible?.result) {
        const r=eligible.result;
        out.push({key:`refinancing:${loan.id}:${eligible.q.bondName}:${eligible.q.date}`,type:'refinancing',title:'Ask for a mortgage refinancing quote',body:`This illustrative ${r.newCouponPercent}% fixed-rate scenario saves DKK ${r.netMonthlySavingDkk} per month after assumed tax relief and breaks even after ${r.breakEvenMonths} months.`,amount:r.netMonthlySavingDkk,severity:'medium',rationale:'Synthetic bond price; equal remaining term; redemption at par; fees and bond-price loss financed. Tax relief assumed at 25%, including contribution fees. Get a lender quote before deciding.',triggeredOn:eligible.q.date,facts:{...r,quoteDate:eligible.q.date,synthetic:eligible.q.origin==='synthetic_fixture',assumptions:'Illustrative, not a live offer; 25% marginal tax relief; permitted par redemption; no tax deduction on principal or setup fees.'}});
      }
    } else if(loan.currency==='DKK'&&loan.rate>FINANCING_ASSUMPTIONS.consolidationAnnualRate) {
      const a=FINANCING_ASSUMPTIONS;
      const current=amortizationSchedule({balance:loan.balance,annualRate:loan.rate,months:loan.remainingTermMonths,monthlyFee:loan.monthlyFee});
      const replacement=amortizationSchedule({balance:loan.balance+a.consolidationSetupFeeDkk,annualRate:a.consolidationAnnualRate,months:loan.remainingTermMonths});
      const net=(rows:typeof current)=>rows.reduce((n,m)=>n+m.payment-m.interest*a.taxReliefRate,0);
      const savings=round2(net(current)-net(replacement));
      const first=current[0],other=replacement[0];if(!first||!other||savings<=0)continue;
      const monthly=round2(first.payment-first.interest*a.taxReliefRate-other.payment+other.interest*a.taxReliefRate);
      out.push({key:`loan-consolidation:${loan.id}:${a.consolidationAnnualRate}`,type:'loan_consolidation',title:'Compare a cheaper consumer loan',body:`An illustrative 7.9% loan over the same ${loan.remainingTermMonths} months saves DKK ${savings} after assumed tax relief and the financed setup fee.`,amount:savings,severity:'medium',rationale:'Comparison keeps the remaining term unchanged. New nominal rate is synthetic, setup fee is DKK 1,000 and marginal interest tax relief is assumed at 25%. Actual ÅOP and approval require a lender quote.',triggeredOn:loan.enteredAt.slice(0,10),facts:{balanceDkk:loan.balance,oldRatePercent:round2(loan.rate*100),newRatePercent:a.consolidationAnnualRate*100,termMonths:loan.remainingTermMonths,setupFeeDkk:a.consolidationSetupFeeDkk,netLifetimeSavingDkk:savings,netFirstMonthSavingDkk:monthly,taxReliefPercent:a.taxReliefRate*100,synthetic:true}});
    }
  }
  return out;
}
