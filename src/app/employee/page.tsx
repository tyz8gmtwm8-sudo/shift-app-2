// 従業員ホーム：希望休カレンダー（F-04〜F-06）
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import DayOffCalendar from "@/components/DayOffCalendar";
import { requireEmployee } from "@/lib/auth";
import { formatMonth, monthKey, monthToDate, normalizeMonth, shiftMonth } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";
import type { DayOffRequest } from "@/lib/types";

export default async function EmployeePage({ searchParams }: PageProps<"/employee">) {
  const profile = await requireEmployee();
  const params = await searchParams;
  const month = normalizeMonth(typeof params.month === "string" ? params.month : null);

  // 選べる月：今月〜再来月
  const minMonth = monthKey(0);
  const maxMonth = monthKey(2);

  const supabase = await createClient();
  const { data } = await supabase
    .from("day_off_requests")
    .select("*")
    .eq("user_id", profile.id)
    .eq("target_month", monthToDate(month))
    .maybeSingle();
  const request = data as DayOffRequest | null;

  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);

  return (
    <>
      <AppHeader name={profile.name} homeHref="/employee" role="employee" />
      <main className="mx-auto w-full max-w-md flex-1 p-4">
        <h1 className="mb-1 text-lg font-bold">希望休の提出</h1>
        <p className="mb-4 text-sm text-slate-600">休みたい日をタップして選び、「提出する」を押してください。</p>

        <div className="mb-3 flex items-center justify-between">
          {prev >= minMonth ? (
            <Link href={`/employee?month=${prev}`} className="btn btn-secondary px-3 py-1">‹ 前月</Link>
          ) : (
            <span className="w-16" />
          )}
          <span className="text-lg font-bold">{formatMonth(month)}</span>
          {next <= maxMonth ? (
            <Link href={`/employee?month=${next}`} className="btn btn-secondary px-3 py-1">翌月 ›</Link>
          ) : (
            <span className="w-16" />
          )}
        </div>

        {/* key を月にすることで、月を切り替えたとき選択状態をリセット */}
        <DayOffCalendar
          key={month}
          month={month}
          initialDates={request?.dates ?? []}
          initialMessage={request?.message ?? ""}
          submittedAt={request?.submitted_at ?? null}
        />
      </main>
    </>
  );
}
