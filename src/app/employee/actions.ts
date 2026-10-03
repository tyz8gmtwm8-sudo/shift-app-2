"use server";
// 希望休の提出処理（F-06）
import { revalidatePath } from "next/cache";
import { requireEmployee } from "@/lib/auth";
import { daysInMonth, monthToDate, normalizeMonth } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";

export type SubmitResult = { ok: boolean; message: string };

export async function submitDayOffRequest(
  month: string,
  dates: string[],
  message: string,
): Promise<SubmitResult> {
  const profile = await requireEmployee();
  const target = normalizeMonth(month);

  // 対象月に含まれる日付だけを受け付ける（不正な値を防ぐ）
  const validDays = new Set(daysInMonth(target));
  const cleanDates = [...new Set(dates)].filter((d) => validDays.has(d)).sort();

  const supabase = await createClient();
  const { error } = await supabase.from("day_off_requests").upsert(
    {
      user_id: profile.id,
      target_month: monthToDate(target),
      dates: cleanDates,
      message: message.trim().slice(0, 1000) || null,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "user_id,target_month" },
  );

  if (error) return { ok: false, message: "提出に失敗しました: " + error.message };
  revalidatePath("/employee");
  return { ok: true, message: "希望休を提出しました" };
}
