"use client";
// =============================================================
// シフト表（F-16〜F-19）
//  ・横＝日付、縦＝名前（登録が早い順）、セルは表示名を表示色で表示
//  ・必要人数に足りない日・表示名は赤で表示
//  ・セルをタップ → 画面下のパネルで表示名／休み／空欄に変更（不足表示も即時更新）
//  ・「完成」でスプレッドシートに保存
// =============================================================
import { useMemo, useState, useTransition } from "react";
import { completeSchedule, saveSchedule } from "@/app/admin/actions";
import { WEEKDAYS, daysInMonth, formatDay, weekdayOf } from "@/lib/date";
import { countByDay } from "@/lib/generate";
import { OFF, type Assignments, type CellValue, type Profile, type ShiftSchedule, type ShiftType } from "@/lib/types";

type Props = {
  month: string;
  employees: Profile[];
  shiftTypes: ShiftType[];
  schedule: ShiftSchedule;
  requested: string[]; // "従業員ID|日付" の一覧（希望休）
};

// 背景色が暗いときは白文字、明るいときは黒文字にする
function textColorFor(hex: string) {
  const v = hex.replace("#", "");
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > 150 ? "#1e293b" : "#ffffff";
}

export default function ShiftTable({ month, employees, shiftTypes, schedule, requested }: Props) {
  const days = useMemo(() => daysInMonth(month), [month]);
  const typeById = useMemo(() => new Map(shiftTypes.map((t) => [t.id, t])), [shiftTypes]);
  const requestedSet = useMemo(() => new Set(requested), [requested]);

  const [assignments, setAssignments] = useState<Assignments>(schedule.assignments ?? {});
  const [selected, setSelected] = useState<{ userId: string; date: string } | null>(null);
  const [dirty, setDirty] = useState(false); // 保存していない変更があるか
  const [status, setStatus] = useState(schedule.status);
  const [sheetUrl, setSheetUrl] = useState(schedule.spreadsheet_url);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  // 日付ごと・表示名ごとの人数（セルを変えるたびに自動で再計算 → 不足表示も即時更新）
  const counts = useMemo(() => countByDay(assignments, days, shiftTypes), [assignments, days, shiftTypes]);
  const isShort = (d: string, t: ShiftType) => counts[d][t.id] < t.required_count;
  const dayHasShortage = (d: string) => shiftTypes.some((t) => isShort(d, t));
  const totalShortage = days.reduce(
    (sum, d) => sum + shiftTypes.reduce((s, t) => s + Math.max(0, t.required_count - counts[d][t.id]), 0),
    0,
  );

  function setCell(value: CellValue) {
    if (!selected) return;
    const { userId, date } = selected;
    setAssignments((prev) => ({ ...prev, [userId]: { ...prev[userId], [date]: value } }));
    setDirty(true);
    setStatus("draft");
    setResult(null);
  }

  function handleSave() {
    startTransition(async () => {
      const res = await saveSchedule(month, assignments);
      setResult(res);
      if (res.ok) setDirty(false);
    });
  }

  function handleComplete() {
    const msg =
      totalShortage > 0
        ? `まだ ${totalShortage} 枠の人員不足があります。このまま完成してスプレッドシートに保存しますか？`
        : "シフトを完成して、スプレッドシートに保存しますか？";
    if (!confirm(msg)) return;
    startTransition(async () => {
      const res = await completeSchedule(month, assignments);
      setResult(res);
      if (res.ok) {
        setDirty(false);
        setStatus("completed");
        setSheetUrl(res.url ?? null);
      }
    });
  }

  // セルの見た目
  function renderCell(value: CellValue) {
    if (value === OFF) return <span className="text-slate-400">休</span>;
    const t = value ? typeById.get(value) : undefined;
    if (!t) return <span className="text-slate-300">—</span>;
    return t.name;
  }

  const selectedEmployee = selected ? employees.find((e) => e.id === selected.userId) : undefined;
  const selectedValue = selected ? (assignments[selected.userId]?.[selected.date] ?? null) : null;

  return (
    <div className="space-y-4 pb-40">
      {/* 状態と操作ボタン */}
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {status === "completed" ? (
            <span className="rounded-full bg-teal-100 px-3 py-1 font-semibold text-teal-800">完成済み</span>
          ) : (
            <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">下書き</span>
          )}
          {totalShortage > 0 ? (
            <span className="rounded-full bg-red-100 px-3 py-1 font-semibold text-red-700">人員不足 {totalShortage} 枠</span>
          ) : (
            <span className="rounded-full bg-teal-50 px-3 py-1 text-teal-700">人員不足なし</span>
          )}
          {dirty && <span className="text-amber-700">※ 未保存の変更があります</span>}
          {sheetUrl && status === "completed" && (
            <a href={sheetUrl} target="_blank" rel="noopener noreferrer" className="text-teal-700 underline">
              スプレッドシートを開く ↗
            </a>
          )}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={handleSave} disabled={isPending || !dirty} className="btn btn-secondary">
            下書き保存
          </button>
          <button type="button" onClick={handleComplete} disabled={isPending} className="btn btn-primary">
            {isPending ? "処理中…" : "完成（スプレッドシートに保存）"}
          </button>
        </div>
      </div>

      {result && (
        <p className={`rounded-lg p-3 text-sm ${result.ok ? "bg-teal-50 text-teal-800" : "bg-red-50 text-red-700"}`}>
          {result.message}
        </p>
      )}

      <p className="text-xs text-slate-500">
        セルをタップすると変更できます。<span className="mx-1 inline-block h-2 w-2 rounded-full bg-orange-400 align-middle" />は希望休の日です。
      </p>

      {/* シフト表本体（横にスクロールできる） */}
      <div className="card overflow-x-auto p-0">
        <table className="border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 min-w-24 border-r border-b border-slate-200 bg-slate-50 p-2 text-left">名前</th>
              {days.map((d) => {
                const wd = weekdayOf(d);
                const short = dayHasShortage(d);
                return (
                  <th
                    key={d}
                    className={`min-w-11 border-b border-slate-200 p-1 text-center font-semibold ${
                      short ? "bg-red-500 text-white" : wd === 0 ? "bg-red-50 text-red-600" : wd === 6 ? "bg-blue-50 text-blue-600" : "bg-slate-50"
                    }`}
                    title={short ? "人員不足があります" : undefined}
                  >
                    <div>{Number(d.slice(8))}</div>
                    <div className="font-normal">{WEEKDAYS[wd]}</div>
                  </th>
                );
              })}
              <th className="min-w-12 border-b border-l border-slate-200 bg-slate-50 p-1">休日数</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => {
              const row = assignments[e.id] ?? {};
              const offCount = days.filter((d) => row[d] === OFF).length;
              return (
                <tr key={e.id}>
                  <th className="sticky left-0 z-10 border-r border-b border-slate-200 bg-white p-2 text-left font-semibold whitespace-nowrap">
                    {e.name}
                    <span className="ml-1 text-[10px] font-normal text-slate-400">
                      {e.employment_type === "parttime" ? "パ" : "社"}
                    </span>
                  </th>
                  {days.map((d) => {
                    const value = row[d] ?? null;
                    const t = value && value !== OFF ? typeById.get(value) : undefined;
                    const isSelected = selected?.userId === e.id && selected.date === d;
                    return (
                      <td key={d} className="border-b border-slate-100 p-0.5">
                        <button
                          type="button"
                          onClick={() => setSelected({ userId: e.id, date: d })}
                          className={`relative h-8 w-full rounded font-semibold ${isSelected ? "ring-2 ring-teal-600 ring-offset-1" : ""} ${t ? "" : "hover:bg-slate-100"}`}
                          style={t ? { backgroundColor: t.color, color: textColorFor(t.color) } : undefined}
                          aria-label={`${e.name} ${formatDay(d)}`}
                        >
                          {renderCell(value)}
                          {requestedSet.has(`${e.id}|${d}`) && (
                            <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-orange-400" />
                          )}
                        </button>
                      </td>
                    );
                  })}
                  <td className="border-b border-l border-slate-100 text-center">{offCount}</td>
                </tr>
              );
            })}

            {/* 表示名ごとの配置人数（不足は赤） */}
            {shiftTypes.map((t, i) => (
              <tr key={t.id}>
                <th className={`sticky left-0 z-10 border-r border-slate-200 bg-slate-50 p-2 text-left whitespace-nowrap ${i === 0 ? "border-t-2 border-t-slate-300" : ""}`}>
                  <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ backgroundColor: t.color }} />
                  {t.name}
                  <span className="ml-1 font-normal text-slate-500">必要{t.required_count}</span>
                </th>
                {days.map((d) => (
                  <td
                    key={d}
                    className={`p-1 text-center ${i === 0 ? "border-t-2 border-t-slate-300" : ""} ${
                      isShort(d, t) ? "bg-red-100 font-bold text-red-700" : "bg-slate-50 text-slate-600"
                    }`}
                  >
                    {counts[d][t.id]}
                  </td>
                ))}
                <td className={`bg-slate-50 ${i === 0 ? "border-t-2 border-t-slate-300" : ""}`} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 選択中のセルを変更するパネル（画面下に固定） */}
      {selected && selectedEmployee && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
          <div className="mx-auto max-w-4xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-bold">
                {selectedEmployee.name} さん ・ {formatDay(selected.date)}
                {requestedSet.has(`${selected.userId}|${selected.date}`) && (
                  <span className="ml-2 rounded bg-orange-100 px-2 py-0.5 text-xs text-orange-700">希望休</span>
                )}
              </p>
              <button type="button" onClick={() => setSelected(null)} className="btn btn-secondary px-3 py-1 text-sm">閉じる</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {shiftTypes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setCell(t.id)}
                  className={`btn px-4 ${selectedValue === t.id ? "ring-2 ring-slate-800 ring-offset-1" : ""}`}
                  style={{ backgroundColor: t.color, color: textColorFor(t.color) }}
                >
                  {t.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCell(OFF)}
                className={`btn btn-secondary px-4 ${selectedValue === OFF ? "ring-2 ring-slate-800 ring-offset-1" : ""}`}
              >
                休み
              </button>
              <button
                type="button"
                onClick={() => setCell(null)}
                className={`btn btn-secondary px-4 text-slate-400 ${selectedValue === null ? "ring-2 ring-slate-800 ring-offset-1" : ""}`}
              >
                空欄
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
