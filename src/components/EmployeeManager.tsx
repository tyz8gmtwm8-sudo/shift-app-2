"use client";
// 従業員の一覧＋登録・編集フォーム
import { useState, useTransition } from "react";
import {
  createEmployee,
  deleteEmployee,
  resendInvite,
  updateEmployee,
  type EmployeeInput,
} from "@/app/admin/actions";
import { WEEKDAYS } from "@/lib/date";
import type { Profile, ShiftType } from "@/lib/types";

const EMPTY: EmployeeInput = {
  name: "",
  email: "",
  employment_type: "fulltime",
  monthly_days_off: 9,
  fixed_weekdays: [],
  fixed_shift_type_id: null,
};

type Props = { employees: Profile[]; shiftTypes: ShiftType[] };

export default function EmployeeManager({ employees, shiftTypes }: Props) {
  const [form, setForm] = useState<EmployeeInput>(EMPTY);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const typeById = new Map(shiftTypes.map((t) => [t.id, t]));

  const update = (patch: Partial<EmployeeInput>) => setForm((f) => ({ ...f, ...patch }));

  function toggleWeekday(w: number) {
    update({
      fixed_weekdays: form.fixed_weekdays.includes(w)
        ? form.fixed_weekdays.filter((x) => x !== w)
        : [...form.fixed_weekdays, w],
    });
  }

  function edit(p: Profile) {
    setResult(null);
    setForm({
      id: p.id,
      name: p.name,
      email: p.email,
      employment_type: p.employment_type ?? "fulltime",
      monthly_days_off: p.monthly_days_off ?? 9,
      fixed_weekdays: p.fixed_weekdays ?? [],
      fixed_shift_type_id: p.fixed_shift_type_id,
    });
  }

  function reset() {
    setForm(EMPTY);
    setResult(null);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = form.id ? await updateEmployee(form) : await createEmployee(form);
      setResult(res);
      if (res.ok) setForm(EMPTY);
    });
  }

  function handleDelete(p: Profile) {
    if (!confirm(`${p.name} さんを削除しますか？\n提出済みの希望休も削除されます。`)) return;
    startTransition(async () => {
      const res = await deleteEmployee(p.id);
      setResult(res);
      if (res.ok && form.id === p.id) setForm(EMPTY);
    });
  }

  function handleResend(p: Profile) {
    startTransition(async () => setResult(await resendInvite(p.id)));
  }

  // 一覧に表示する勤務条件の説明文
  function conditionText(p: Profile) {
    if (p.employment_type === "parttime") {
      const days = (p.fixed_weekdays ?? []).map((w) => WEEKDAYS[w]).join("・") || "未設定";
      const type = p.fixed_shift_type_id ? typeById.get(p.fixed_shift_type_id)?.name : null;
      return `${days}曜 / ${type ?? "表示名未設定"}`;
    }
    return `月${p.monthly_days_off ?? "?"}日休み`;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      {/* 一覧（登録が早い順） */}
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="p-3">名前</th>
              <th className="p-3">区分</th>
              <th className="p-3">勤務条件</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-slate-500">まだ登録がありません</td>
              </tr>
            )}
            {employees.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="p-3">
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-xs text-slate-500">{p.email}</div>
                </td>
                <td className="p-3 whitespace-nowrap">
                  <span className={`rounded px-2 py-0.5 text-xs font-semibold ${p.employment_type === "parttime" ? "bg-amber-100 text-amber-800" : "bg-teal-100 text-teal-800"}`}>
                    {p.employment_type === "parttime" ? "パート" : "社員"}
                  </span>
                </td>
                <td className="p-3">{conditionText(p)}</td>
                <td className="p-3 text-right whitespace-nowrap">
                  <button type="button" onClick={() => edit(p)} className="btn btn-secondary px-3 py-1 text-xs">編集</button>
                  <button type="button" onClick={() => handleResend(p)} disabled={isPending} className="btn btn-secondary ml-2 px-3 py-1 text-xs" title="パスワード未設定の人に招待メールを再送">再招待</button>
                  <button type="button" onClick={() => handleDelete(p)} disabled={isPending} className="btn btn-danger ml-2 px-3 py-1 text-xs">削除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 登録・編集フォーム */}
      <form onSubmit={handleSave} className="card space-y-4 self-start">
        <h2 className="font-bold">{form.id ? "従業員を編集" : "従業員を登録"}</h2>
        <div>
          <label className="label" htmlFor="emp-name">名前</label>
          <input id="emp-name" className="input" required value={form.name} onChange={(e) => update({ name: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="emp-email">メールアドレス（ログインID）</label>
          <input id="emp-email" type="email" className="input" required value={form.email} onChange={(e) => update({ email: e.target.value })} />
        </div>

        <fieldset>
          <legend className="label">区分</legend>
          <div className="flex gap-2">
            {(["fulltime", "parttime"] as const).map((t) => (
              <label key={t} className={`flex-1 cursor-pointer rounded-lg border p-2 text-center font-semibold ${form.employment_type === t ? "border-teal-600 bg-teal-50 text-teal-800" : "border-slate-300"}`}>
                <input type="radio" name="employment_type" className="sr-only" checked={form.employment_type === t} onChange={() => update({ employment_type: t })} />
                {t === "fulltime" ? "社員" : "パート"}
              </label>
            ))}
          </div>
        </fieldset>

        {form.employment_type === "fulltime" ? (
          <div>
            <label className="label" htmlFor="emp-off">月間休日数</label>
            <input id="emp-off" type="number" min={0} max={31} required className="input" value={form.monthly_days_off ?? ""} onChange={(e) => update({ monthly_days_off: e.target.value === "" ? null : Number(e.target.value) })} />
          </div>
        ) : (
          <>
            <fieldset>
              <legend className="label">固定出勤曜日</legend>
              <div className="grid grid-cols-7 gap-1">
                {WEEKDAYS.map((w, i) => (
                  <button key={w} type="button" onClick={() => toggleWeekday(i)} aria-pressed={form.fixed_weekdays.includes(i)} className={`rounded-lg border py-2 text-sm font-semibold ${form.fixed_weekdays.includes(i) ? "border-teal-600 bg-teal-600 text-white" : "border-slate-300 bg-white"}`}>
                    {w}
                  </button>
                ))}
              </div>
            </fieldset>
            <div>
              <label className="label" htmlFor="emp-type">固定出勤の表示名</label>
              <select id="emp-type" className="input" required value={form.fixed_shift_type_id ?? ""} onChange={(e) => update({ fixed_shift_type_id: e.target.value || null })}>
                <option value="">選択してください</option>
                {shiftTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {shiftTypes.length === 0 && <p className="mt-1 text-xs text-amber-700">先に「表示名設定」で表示名を登録してください</p>}
            </div>
          </>
        )}

        {result && (
          <p className={`rounded-lg p-3 text-sm ${result.ok ? "bg-teal-50 text-teal-800" : "bg-red-50 text-red-700"}`}>{result.message}</p>
        )}
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary flex-1" disabled={isPending}>
            {isPending ? "処理中…" : form.id ? "保存" : "登録して招待メールを送る"}
          </button>
          {form.id && <button type="button" className="btn btn-secondary" onClick={reset}>キャンセル</button>}
        </div>
      </form>
    </div>
  );
}
