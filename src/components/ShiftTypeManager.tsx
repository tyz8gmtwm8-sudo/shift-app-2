"use client";
// 表示名の一覧＋登録・編集フォーム
import { useState, useTransition } from "react";
import { deleteShiftType, saveShiftType, type ShiftTypeInput } from "@/app/admin/actions";
import { formatTime } from "@/lib/date";
import type { ShiftType } from "@/lib/types";

const EMPTY: ShiftTypeInput = {
  name: "",
  color: "#60a5fa",
  start_time: "09:00",
  end_time: "18:00",
  required_count: 1,
  crosses_midnight: false,
};

export default function ShiftTypeManager({ shiftTypes }: { shiftTypes: ShiftType[] }) {
  const [form, setForm] = useState<ShiftTypeInput>(EMPTY);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  // フォームの一部の項目だけを書き換える
  const update = (patch: Partial<ShiftTypeInput>) => setForm((f) => ({ ...f, ...patch }));

  function edit(t: ShiftType) {
    setResult(null);
    setForm({
      id: t.id,
      name: t.name,
      color: t.color,
      start_time: t.start_time.slice(0, 5),
      end_time: t.end_time.slice(0, 5),
      required_count: t.required_count,
      crosses_midnight: t.crosses_midnight,
    });
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveShiftType(form);
      setResult(res);
      if (res.ok) setForm(EMPTY);
    });
  }

  function handleDelete(t: ShiftType) {
    if (!confirm(`「${t.name}」を削除しますか？`)) return;
    startTransition(async () => {
      const res = await deleteShiftType(t.id);
      setResult(res);
      if (res.ok && form.id === t.id) setForm(EMPTY);
    });
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_320px]">
      {/* 一覧 */}
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="p-3">表示名</th>
              <th className="p-3">勤務時間</th>
              <th className="p-3">必要人数</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {shiftTypes.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-slate-500">まだ登録がありません</td>
              </tr>
            )}
            {shiftTypes.map((t) => (
              <tr key={t.id} className="border-t border-slate-100">
                <td className="p-3">
                  <span className="rounded px-2 py-1 font-semibold" style={{ backgroundColor: t.color }}>
                    {t.name}
                  </span>
                </td>
                <td className="p-3 whitespace-nowrap">
                  {formatTime(t.start_time)}〜{t.crosses_midnight && "翌"}
                  {formatTime(t.end_time)}
                  {t.crosses_midnight && (
                    <span className="ml-2 rounded bg-indigo-100 px-1.5 py-0.5 text-xs text-indigo-700">日またぎ</span>
                  )}
                </td>
                <td className="p-3">{t.required_count}人</td>
                <td className="p-3 text-right whitespace-nowrap">
                  <button type="button" onClick={() => edit(t)} className="btn btn-secondary px-3 py-1 text-xs">編集</button>
                  <button type="button" onClick={() => handleDelete(t)} disabled={isPending} className="btn btn-danger ml-2 px-3 py-1 text-xs">削除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 登録・編集フォーム */}
      <form onSubmit={handleSave} className="card space-y-4 self-start">
        <h2 className="font-bold">{form.id ? "表示名を編集" : "表示名を追加"}</h2>
        <div>
          <label className="label" htmlFor="st-name">表示名</label>
          <input id="st-name" className="input" required placeholder="例：早番" value={form.name} onChange={(e) => update({ name: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="st-color">表示色</label>
          <div className="flex items-center gap-3">
            <input id="st-color" type="color" className="h-10 w-16 cursor-pointer rounded border border-slate-300" value={form.color} onChange={(e) => update({ color: e.target.value })} />
            <span className="rounded px-2 py-1 font-semibold" style={{ backgroundColor: form.color }}>{form.name || "見本"}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="st-start">開始</label>
            <input id="st-start" type="time" required className="input" value={form.start_time} onChange={(e) => update({ start_time: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="st-end">終了</label>
            <input id="st-end" type="time" required className="input" value={form.end_time} onChange={(e) => update({ end_time: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="st-required">必要人数（1日あたり）</label>
          <input id="st-required" type="number" min={0} required className="input" value={form.required_count} onChange={(e) => update({ required_count: Number(e.target.value) })} />
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="h-4 w-4" checked={form.crosses_midnight} onChange={(e) => update({ crosses_midnight: e.target.checked })} />
          <span className="text-sm font-semibold">日をまたぐ（翌日を自動で休みにする）</span>
        </label>

        {result && (
          <p className={`rounded-lg p-3 text-sm ${result.ok ? "bg-teal-50 text-teal-800" : "bg-red-50 text-red-700"}`}>{result.message}</p>
        )}
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary flex-1" disabled={isPending}>{isPending ? "保存中…" : "保存"}</button>
          {form.id && (
            <button type="button" className="btn btn-secondary" onClick={() => { setForm(EMPTY); setResult(null); }}>キャンセル</button>
          )}
        </div>
      </form>
    </div>
  );
}
