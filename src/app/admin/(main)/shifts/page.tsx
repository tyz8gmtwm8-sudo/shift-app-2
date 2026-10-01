// シフト表表示画面（F-16〜F-19）
import Link from "next/link";
import MonthNav from "@/components/MonthNav";
import ShiftTable from "@/components/ShiftTable";
import { monthToDate, normalizeMonth } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";
import type { DayOffRequest, Profile, ShiftSchedule, ShiftType } from "@/lib/types";

export default async function ShiftsPage({ searchParams }: PageProps<"/admin/shifts">) {
  const params = await searchParams;
  const month = normalizeMonth(typeof params.month === "string" ? params.month : null);

  const supabase = await createClient();
  const [{ data: employees }, { data: shiftTypes }, { data: schedule }, { data: requests }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("role", "employee").order("created_at"),
      supabase.from("shift_types").select("*").order("start_time"),
      supabase.from("shift_schedules").select("*").eq("target_month", monthToDate(month)).maybeSingle(),
      supabase.from("day_off_requests").select("user_id, dates").eq("target_month", monthToDate(month)),
    ]);

  // 希望休を「従業員ID|日付」の一覧にして、表に印を付けるのに使う
  const requested = ((requests ?? []) as Pick<DayOffRequest, "user_id" | "dates">[]).flatMap((r) =>
    r.dates.map((d) => `${r.user_id}|${d}`),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">シフト表</h1>
        <MonthNav month={month} basePath="/admin/shifts" />
      </div>

      {schedule ? (
        <ShiftTable
          // 月が変わったら表を作り直す
          key={month}
          month={month}
          employees={(employees ?? []) as Profile[]}
          shiftTypes={(shiftTypes ?? []) as ShiftType[]}
          schedule={schedule as ShiftSchedule}
          requested={requested}
        />
      ) : (
        <div className="card text-center">
          <p className="mb-4 text-slate-600">この月のシフトはまだ作成されていません。</p>
          <Link href={`/admin/generate?month=${month}`} className="btn btn-primary">自動作成へ進む</Link>
        </div>
      )}
    </div>
  );
}
