import type { ActionCandidate, Category, ISODate } from '../types.ts';
import type { ValuedTransaction } from './transactions.ts';
export interface BudgetStatus { category: Category; spent: number; budget: number; remaining: number; pace: number; daysLeft: number; projected: number }
export interface RecurringPayment { id: string; accountId: string; name: string; category: Category; type: 'salary'|'bill'|'subscription'; amountDkk: number; previousAmountDkk?: number; changeDkk?: number; lastDate: ISODate; dayOfMonth: number; bankingDayAdjusted: boolean; monthEnd: boolean; occurrences: number; estimated: true }
export interface ForecastBill { id: string; name: string; date: ISODate; amountDkk: number; estimated: true; accountId: string }
export interface CashForecast { asOf: ISODate; horizonEnd: ISODate; todayBalanceDkk: number; nextPayday: ISODate|null; daysToPayday: number|null; projectedAtPaydayDkk: number|null; minimumBalanceDkk: number; bills: ForecastBill[]; daily: {date:ISODate;balanceDkk:number;beforeIncomeBalanceDkk:number}[]; dailyDiscretionaryDkk: number; reliable: boolean; warnings: string[] }
export interface FinanceSnapshot {
  asOf: ISODate;
  transactions: ValuedTransaction[];
  totals: {cashDkk:number;investmentsDkk:number;totalDkk:number;complete:boolean};
  budgets: BudgetStatus[];
  recurring: RecurringPayment[];
  forecast: CashForecast;
  safetyNet: {months:number;monthlyEssentialsDkk:number;bufferDkk:number;targetDkk:number;gapDkk:number;estimated:true};
  surplus: {amountDkk:number;fromAccountId?:string;toAccountId?:string;reliable:boolean};
  risk: {portfolioDkk:number;equityPercent:number;largestHoldingPercent:number;largestHoldingName:string|null;homeBiasPercent:number;unrealizedPnlDkk:number|null;costBasisDrawdownPercent:number|null;tolerance:'low'|'moderate'|'high';complete:boolean};
  candidates: ActionCandidate[];
  warnings: string[];
}
