import { round2 } from "../util.ts";

/** Monthly annuity payment (principal + interest) for a balance, annual rate and term in months. */
export function annuityPayment(balance: number, annualRate: number, months: number): number {
  if (months <= 0) return balance;
  const r = annualRate / 12;
  if (r === 0) return balance / months;
  return (balance * r) / (1 - Math.pow(1 + r, -months));
}

export interface ScheduleMonth {
  month: number;
  openingBalance: number;
  interest: number;
  /** Contribution fee (bidrag) on the opening balance; zero for non-mortgage loans. */
  contribution: number;
  principal: number;
  /** Total payment before tax: annuity + contribution + fees. */
  payment: number;
  closingBalance: number;
}

/**
 * Amortisation schedule for an annuity loan. Danish mortgage contribution
 * (bidrag) is charged on the outstanding balance on top of the annuity.
 */
export function amortizationSchedule(input: {
  balance: number;
  annualRate: number;
  months: number;
  contributionRate?: number;
  monthlyFee?: number;
  horizonMonths?: number;
}): ScheduleMonth[] {
  const { balance, annualRate, months } = input;
  const contributionRate = input.contributionRate ?? 0;
  const fee = input.monthlyFee ?? 0;
  const horizon = Math.min(input.horizonMonths ?? months, months);
  const pmt = annuityPayment(balance, annualRate, months);
  const out: ScheduleMonth[] = [];
  let b = balance;
  for (let m = 1; m <= horizon; m++) {
    const interest = b * (annualRate / 12);
    const contribution = b * (contributionRate / 12);
    const principal = Math.min(b, pmt - interest);
    const closing = b - principal;
    out.push({
      month: m,
      openingBalance: b,
      interest,
      contribution,
      principal,
      payment: principal + interest + contribution + fee,
      closingBalance: closing,
    });
    b = closing;
  }
  return out;
}

export function firstMonthPayment(input: {
  balance: number;
  annualRate: number;
  months: number;
  contributionRate?: number;
  monthlyFee?: number;
}): number {
  const s = amortizationSchedule({ ...input, horizonMonths: 1 })[0];
  return round2(s ? s.payment : 0);
}
