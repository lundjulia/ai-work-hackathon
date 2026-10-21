import type { ISODate } from "./types.ts";

// ---------------------------------------------------------------------------
// Dates (calendar days as ISO strings, computed in UTC to avoid DST drift)
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

export function parseDate(date: ISODate): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}

export function formatDate(date: Date): ISODate {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: ISODate, days: number): ISODate {
  return formatDate(new Date(parseDate(date).getTime() + days * DAY_MS));
}

export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / DAY_MS);
}

export function compareDates(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function monthKey(date: ISODate): string {
  return date.slice(0, 7);
}

export function startOfMonth(date: ISODate): ISODate {
  return `${date.slice(0, 7)}-01`;
}

export function daysInMonth(date: ISODate): number {
  const d = parseDate(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

export function endOfMonth(date: ISODate): ISODate {
  return `${date.slice(0, 7)}-${String(daysInMonth(date)).padStart(2, "0")}`;
}

export function addMonths(date: ISODate, months: number): ISODate {
  const d = parseDate(date);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const dim = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), dim));
  return formatDate(target);
}

/** 0 = Sunday ... 6 = Saturday */
export function weekday(date: ISODate): number {
  return parseDate(date).getUTCDay();
}

export function isWeekend(date: ISODate): boolean {
  const w = weekday(date);
  return w === 0 || w === 6;
}

/** Next banking day on or after `date`. Weekends only; Danish public holidays are not modelled. */
export function nextBankingDay(date: ISODate): ISODate {
  let d = date;
  while (isWeekend(d)) d = addDays(d, 1);
  return d;
}

/** Last banking day of the month containing `date` (Danish salary convention). Weekends only. */
export function lastBankingDayOfMonth(date: ISODate): ISODate {
  let d = endOfMonth(date);
  while (isWeekend(d)) d = addDays(d, -1);
  return d;
}

export function eachDay(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** `asOf` is end-of-day; this is the canonical retrieval timestamp for a simulated day (22:00 Copenhagen summer time). */
export function retrievalTime(asOf: ISODate): string {
  return `${asOf}T20:00:00.000Z`;
}

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}

export function floorTo(n: number, step: number): number {
  return Math.floor(n / step) * step;
}

export function ceilTo(n: number, step: number): number {
  return Math.ceil(n / step) * step;
}

export function sum(values: readonly number[]): number {
  return round2(values.reduce((a, b) => a + b, 0));
}

export function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2 : (s[mid] ?? 0);
}

export function stdDev(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((a, v) => a + (v - m) ** 2, 0) / (values.length - 1));
}

// ---------------------------------------------------------------------------
// Deterministic randomness and hashing
// ---------------------------------------------------------------------------

/** Mulberry32 PRNG. Deterministic for a given seed. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a 32-bit hash as 8 hex chars; used for deterministic derived IDs. */
export function hashString(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function formatDkk(amount: number): string {
  const rounded = Math.round(amount);
  const s = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${rounded < 0 ? "-" : ""}DKK ${s}`;
}
