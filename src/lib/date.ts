// 日付まわりの便利関数
// タイムゾーンのずれを防ぐため、日付は "YYYY-MM-DD" の文字列で扱います。

export const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

const pad = (n: number) => String(n).padStart(2, "0");

/** 日本時間の「今日」の年・月（1〜12）を返す */
function nowInJapan() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date());
  const year = Number(parts.find((p) => p.type === "year")!.value);
  const month = Number(parts.find((p) => p.type === "month")!.value);
  return { year, month };
}

/** "YYYY-MM"（対象月）を作る。offset=1 なら来月 */
export function monthKey(offset = 0): string {
  const { year, month } = nowInJapan();
  const d = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

/** "YYYY-MM" が正しい形式かチェックし、だめなら来月を返す */
export function normalizeMonth(value: string | undefined | null): string {
  if (value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return value;
  return monthKey(1);
}

/** "YYYY-MM" → DB保存用の "YYYY-MM-01" */
export function monthToDate(month: string): string {
  return `${month}-01`;
}

/** "YYYY-MM" を n か月ずらす */
export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

/** その月の全日付 ["YYYY-MM-01", ..., "YYYY-MM-末日"] */
export function daysInMonth(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: last }, (_, i) => `${month}-${pad(i + 1)}`);
}

/** "YYYY-MM-DD" の曜日（0=日 … 6=土） */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** "YYYY-MM" → "2026年11月" */
export function formatMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${y}年${m}月`;
}

/** "YYYY-MM-DD" → "11/3(火)" */
export function formatDay(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${m}/${d}(${WEEKDAYS[weekdayOf(date)]})`;
}

/** "07:00:00" → "7:00" */
export function formatTime(time: string): string {
  const [h, m] = time.split(":");
  return `${Number(h)}:${m}`;
}
