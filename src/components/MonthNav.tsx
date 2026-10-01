// 「‹ 前月 / 2026年11月 / 翌月 ›」の月切り替え
import Link from "next/link";
import { formatMonth, shiftMonth } from "@/lib/date";

export default function MonthNav({ month, basePath }: { month: string; basePath: string }) {
  return (
    <div className="flex items-center gap-2">
      <Link href={`${basePath}?month=${shiftMonth(month, -1)}`} className="btn btn-secondary px-3 py-1">‹ 前月</Link>
      <span className="min-w-28 text-center text-lg font-bold">{formatMonth(month)}</span>
      <Link href={`${basePath}?month=${shiftMonth(month, 1)}`} className="btn btn-secondary px-3 py-1">翌月 ›</Link>
    </div>
  );
}
