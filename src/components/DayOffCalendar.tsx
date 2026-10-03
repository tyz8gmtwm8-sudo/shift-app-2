"use client";
// 希望休カレンダー（タップで選択／解除）＋メッセージ欄＋提出ボタン
import { useState, useTransition } from "react";
import { submitDayOffRequest } from "@/app/employee/actions";
import { WEEKDAYS, daysInMonth, weekdayOf } from "@/lib/date";

type Props = {
  month: string;
  initialDates: string[];
  initialMessage: string;
  submittedAt: string | null;
};

export default function DayOffCalendar({ month, initialDates, initialMessage, submittedAt }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialDates));
  const [message, setMessage] = useState(initialMessage);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const days = daysInMonth(month);
  // 1日の曜日の分だけ、先頭に空白マスを入れる
  const blanks = Array.from({ length: weekdayOf(days[0]) });

  function toggle(date: string) {
    setResult(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  function handleSubmit() {
    startTransition(async () => {
      const res = await submitDayOffRequest(month, [...selected], message);
      setResult(res);
    });
  }

  return (
    <div className="space-y-4">
      <div className="card p-3">
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold">
          {WEEKDAYS.map((w, i) => (
            <div key={w} className={i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-slate-500"}>
              {w}
            </div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {blanks.map((_, i) => (
            <div key={`b${i}`} />
          ))}
          {days.map((d) => {
            const isOn = selected.has(d);
            const wd = weekdayOf(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggle(d)}
                aria-pressed={isOn}
                className={`flex aspect-square flex-col items-center justify-center rounded-lg border text-sm transition ${
                  isOn
                    ? "border-teal-600 bg-teal-600 font-bold text-white"
                    : `border-slate-200 bg-white hover:bg-teal-50 ${
                        wd === 0 ? "text-red-500" : wd === 6 ? "text-blue-500" : ""
                      }`
                }`}
              >
                {Number(d.slice(8))}
                {isOn && <span className="text-[10px] leading-none">休</span>}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-sm text-slate-600">選択中：{selected.size}日</p>
      </div>

      <div>
        <label htmlFor="message" className="label">管理者へのメッセージ（任意）</label>
        <textarea
          id="message"
          rows={3}
          maxLength={1000}
          className="input"
          placeholder="例：通院のため午前中は難しいです"
          value={message}
          onChange={(e) => {
            setResult(null);
            setMessage(e.target.value);
          }}
        />
      </div>

      {result && (
        <p className={`rounded-lg p-3 text-sm ${result.ok ? "bg-teal-50 text-teal-800" : "bg-red-50 text-red-700"}`}>
          {result.message}
        </p>
      )}

      <button type="button" onClick={handleSubmit} disabled={isPending} className="btn btn-primary w-full py-3 text-lg">
        {isPending ? "送信中…" : submittedAt ? "内容を更新して提出する" : "提出する"}
      </button>
      {submittedAt && (
        <p className="text-center text-xs text-slate-500">
          最終提出：{new Date(submittedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
        </p>
      )}
    </div>
  );
}
