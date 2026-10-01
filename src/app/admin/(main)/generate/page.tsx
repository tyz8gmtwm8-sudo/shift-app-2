// 自動作成画面：提出状況の確認とシフト生成（F-12〜F-15）
import Link from "next/link";
import { generateShift } from "@/app/admin/actions";
import GenerateButton from "@/components/GenerateButton";
import MonthNav from "@/components/MonthNav";
import { daysInMonth, formatDay, monthToDate, normalizeMonth } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";
import type { DayOffRequest, Profile } from "@/lib/types";

export default async function GeneratePage({ searchParams }: PageProps<"/admin/generate">) {
  const params = await searchParams;
  const month = normalizeMonth(typeof params.month === "string" ? params.month : null);
  const days = daysInMonth(month);

  const supabase = await createClient();
  const [{ data: employeesData }, { data: requestsData }, { data: schedule }, { count: typeCount }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("role", "employee").order("created_at"),
      supabase.from("day_off_requests").select("*").eq("target_month", monthToDate(month)),
      supabase.from("shift_schedules").select("status").eq("target_month", monthToDate(month)).maybeSingle(),
      supabase.from("shift_types").select("id", { count: "exact", head: true }),
    ]);
  const employees = (employeesData ?? []) as Profile[];
  const requests = (requestsData ?? []) as DayOffRequest[];
  const requestByUser = new Map(requests.map((r) => [r.user_id, r]));

  const submitted = employees.filter((e) => requestByUser.has(e.id));
  const notSubmitted = employees.filter((e) => !requestByUser.has(e.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">自動作成</h1>
        <MonthNav month={month} basePath="/admin/generate" />
      </div>

      {/* 提出状況（F-12） */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-sm text-slate-500">対象期間</p>
          <p className="mt-1 text-lg font-bold">{formatDay(days[0])} 〜 {formatDay(days[days.length - 1])}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">スタッフ数</p>
          <p className="mt-1 text-3xl font-bold">{employees.length}<span className="ml-1 text-base">人</span></p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">提出人数</p>
          <p className="mt-1 text-3xl font-bold">
            {submitted.length}
            <span className="ml-1 text-base text-slate-500">/ {employees.length}人</span>
          </p>
        </div>
      </div>

      {/* 未提出者（F-13）：黄色で表示 */}
      <div className="card">
        <h2 className="mb-3 font-bold">未提出者（{notSubmitted.length}人）</h2>
        {notSubmitted.length === 0 ? (
          <p className="text-sm text-teal-700">全員が提出済みです 🎉</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {notSubmitted.map((e) => (
              <span key={e.id} className="rounded-full border border-yellow-300 bg-yellow-200 px-3 py-1 text-sm font-semibold text-yellow-900">
                {e.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 希望休・メッセージ一覧（F-14） */}
      <div className="card overflow-x-auto p-0">
        <h2 className="p-4 pb-2 font-bold">提出された希望休とメッセージ</h2>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="p-3 whitespace-nowrap">名前</th>
              <th className="p-3">希望休</th>
              <th className="p-3">メッセージ</th>
              <th className="p-3 whitespace-nowrap">提出日時</th>
            </tr>
          </thead>
          <tbody>
            {submitted.length === 0 && (
              <tr><td colSpan={4} className="p-6 text-center text-slate-500">まだ提出がありません</td></tr>
            )}
            {submitted.map((e) => {
              const r = requestByUser.get(e.id)!;
              return (
                <tr key={e.id} className="border-t border-slate-100 align-top">
                  <td className="p-3 font-semibold whitespace-nowrap">{e.name}</td>
                  <td className="p-3">
                    {r.dates.length === 0 ? (
                      <span className="text-slate-400">なし</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {r.dates.map((d) => (
                          <span key={d} className="rounded bg-teal-50 px-1.5 py-0.5 text-xs text-teal-800">{formatDay(d)}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="p-3 whitespace-pre-wrap">{r.message || <span className="text-slate-400">—</span>}</td>
                  <td className="p-3 text-xs whitespace-nowrap text-slate-500">
                    {new Date(r.submitted_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 生成ボタン（F-15） */}
      <div className="card flex flex-col items-center gap-3 text-center">
        {(typeCount ?? 0) === 0 ? (
          <p className="text-sm text-amber-700">
            表示名が登録されていません。先に<Link href="/admin/shift-types" className="underline">表示名設定</Link>を行ってください。
          </p>
        ) : (
          <>
            {notSubmitted.length > 0 && (
              <p className="text-sm text-yellow-800">未提出者がいます。未提出の人は希望休なしとして作成されます。</p>
            )}
            <form action={generateShift}>
              <input type="hidden" name="month" value={month} />
              <GenerateButton hasExisting={!!schedule} />
            </form>
            {schedule && (
              <Link href={`/admin/shifts?month=${month}`} className="text-sm text-teal-700 underline">
                作成済みのシフト表を見る
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}
