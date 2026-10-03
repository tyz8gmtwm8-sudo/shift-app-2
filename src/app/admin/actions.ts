"use server";
// =============================================================
// 管理者用のサーバー処理（Server Actions）
// どの処理も最初に requireAdmin() で管理者かどうかを確認します。
// =============================================================
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { daysInMonth, monthToDate, normalizeMonth, shiftMonth } from "@/lib/date";
import { generateSchedule } from "@/lib/generate";
import { saveToSpreadsheet } from "@/lib/sheets";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  OFF,
  type Assignments,
  type DayOffRequest,
  type Profile,
  type ShiftType,
} from "@/lib/types";

export type ActionResult = { ok: boolean; message: string; url?: string };

// -------------------------------------------------------------
// 表示名設定（F-10, F-11）
// -------------------------------------------------------------
export type ShiftTypeInput = {
  id?: string;
  name: string;
  color: string;
  start_time: string;
  end_time: string;
  required_count: number;
  crosses_midnight: boolean;
};

export async function saveShiftType(input: ShiftTypeInput): Promise<ActionResult> {
  await requireAdmin();
  const name = input.name.trim();
  if (!name) return { ok: false, message: "表示名を入力してください" };
  if (!/^#[0-9a-fA-F]{6}$/.test(input.color)) return { ok: false, message: "表示色が正しくありません" };
  if (!input.start_time || !input.end_time) return { ok: false, message: "勤務時間を入力してください" };
  const required = Math.max(0, Math.floor(Number(input.required_count) || 0));

  const row = {
    name,
    color: input.color,
    start_time: input.start_time,
    end_time: input.end_time,
    required_count: required,
    crosses_midnight: input.crosses_midnight,
  };
  const supabase = await createClient();
  const { error } = input.id
    ? await supabase.from("shift_types").update(row).eq("id", input.id)
    : await supabase.from("shift_types").insert(row);
  if (error) return { ok: false, message: "保存に失敗しました: " + error.message };

  revalidatePath("/admin/shift-types");
  return { ok: true, message: "保存しました" };
}

export async function deleteShiftType(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("shift_types").delete().eq("id", id);
  if (error) return { ok: false, message: "削除に失敗しました: " + error.message };
  revalidatePath("/admin/shift-types");
  return { ok: true, message: "削除しました" };
}

// -------------------------------------------------------------
// 従業員設定（F-07〜F-09）
// -------------------------------------------------------------
export type EmployeeInput = {
  id?: string;
  name: string;
  email: string;
  employment_type: "fulltime" | "parttime";
  monthly_days_off: number | null;
  fixed_weekdays: number[];
  fixed_shift_type_id: string | null;
};

// 社員／パートに応じて、使わない項目は空にする
function employeeConditions(input: EmployeeInput) {
  if (input.employment_type === "fulltime") {
    return {
      employment_type: "fulltime" as const,
      monthly_days_off: Math.max(0, Math.floor(Number(input.monthly_days_off) || 0)),
      fixed_weekdays: [],
      fixed_shift_type_id: null,
    };
  }
  return {
    employment_type: "parttime" as const,
    monthly_days_off: null,
    fixed_weekdays: [...new Set(input.fixed_weekdays)].filter((w) => w >= 0 && w <= 6).sort(),
    fixed_shift_type_id: input.fixed_shift_type_id || null,
  };
}

function validateEmployee(input: EmployeeInput): string | null {
  if (!input.name.trim()) return "名前を入力してください";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) return "メールアドレスが正しくありません";
  if (input.employment_type === "fulltime" && input.monthly_days_off === null)
    return "月間休日数を入力してください";
  if (input.employment_type === "parttime") {
    if (input.fixed_weekdays.length === 0) return "固定出勤曜日を選んでください";
    if (!input.fixed_shift_type_id) return "固定出勤の表示名を選んでください";
  }
  return null;
}

// 招待メールのリンクの戻り先（このアプリの URL）
async function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function createEmployee(input: EmployeeInput): Promise<ActionResult> {
  await requireAdmin();
  const invalid = validateEmployee(input);
  if (invalid) return { ok: false, message: invalid };

  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();

  // 1. 招待メールを送信（Supabase Auth にユーザーが作られる）
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { name },
    redirectTo: `${await siteUrl()}/auth/set-password`,
  });
  if (error || !data.user) {
    return { ok: false, message: "招待メールを送れませんでした: " + (error?.message ?? "") };
  }

  // 2. プロフィール（勤務条件）を登録
  const { error: profileError } = await admin.from("profiles").insert({
    id: data.user.id,
    role: "employee",
    name,
    email,
    ...employeeConditions(input),
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id); // 中途半端な状態を残さない
    return { ok: false, message: "登録に失敗しました: " + profileError.message };
  }

  revalidatePath("/admin/employees");
  return { ok: true, message: `${name} さんを登録し、招待メールを送信しました` };
}

export async function updateEmployee(input: EmployeeInput): Promise<ActionResult> {
  await requireAdmin();
  if (!input.id) return { ok: false, message: "従業員が指定されていません" };
  const invalid = validateEmployee(input);
  if (invalid) return { ok: false, message: invalid };

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", input.id)
    .eq("role", "employee")
    .single();
  if (!current) return { ok: false, message: "従業員が見つかりません" };

  const email = input.email.trim().toLowerCase();
  // メールアドレス（ログインID）が変わった場合はログイン情報も変更
  if (email !== current.email) {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(input.id, { email, email_confirm: true });
    if (error) return { ok: false, message: "メールアドレスを変更できませんでした: " + error.message };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ name: input.name.trim(), email, ...employeeConditions(input) })
    .eq("id", input.id);
  if (error) return { ok: false, message: "保存に失敗しました: " + error.message };

  revalidatePath("/admin/employees");
  return { ok: true, message: "保存しました" };
}

export async function deleteEmployee(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: target } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", id)
    .eq("role", "employee")
    .single();
  if (!target) return { ok: false, message: "従業員が見つかりません" };

  // ログイン用ユーザーを削除すると、プロフィール・希望休も自動で消えます
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return { ok: false, message: "削除に失敗しました: " + error.message };

  revalidatePath("/admin/employees");
  return { ok: true, message: "削除しました" };
}

export async function resendInvite(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: target } = await supabase.from("profiles").select("email").eq("id", id).single();
  if (!target) return { ok: false, message: "従業員が見つかりません" };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(target.email, {
    redirectTo: `${await siteUrl()}/auth/set-password`,
  });
  if (error) return { ok: false, message: "再送できませんでした: " + error.message };
  return { ok: true, message: "招待メールを再送しました" };
}

// -------------------------------------------------------------
// シフト自動生成（F-15）
// -------------------------------------------------------------
export async function generateShift(formData: FormData) {
  await requireAdmin();
  const month = normalizeMonth(String(formData.get("month") ?? ""));
  const supabase = await createClient();

  const [{ data: employees }, { data: shiftTypes }, { data: requests }, { data: prev }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("role", "employee").order("created_at"),
      supabase.from("shift_types").select("*").order("start_time"),
      supabase.from("day_off_requests").select("*").eq("target_month", monthToDate(month)),
      supabase
        .from("shift_schedules")
        .select("assignments")
        .eq("target_month", monthToDate(shiftMonth(month, -1)))
        .maybeSingle(),
    ]);

  // 前月末日の勤務（前月末が夜勤なら当月1日を休みにするため）
  const prevDays = daysInMonth(shiftMonth(month, -1));
  const prevLast = prevDays[prevDays.length - 1];
  const prevAssignments = (prev?.assignments ?? {}) as Assignments;
  const previousLastDay = Object.fromEntries(
    Object.entries(prevAssignments).map(([uid, row]) => [uid, row[prevLast] ?? null]),
  );

  const assignments = generateSchedule({
    month,
    employees: (employees ?? []) as Profile[],
    shiftTypes: (shiftTypes ?? []) as ShiftType[],
    requests: (requests ?? []) as DayOffRequest[],
    previousLastDay,
  });

  const { error } = await supabase.from("shift_schedules").upsert({
    target_month: monthToDate(month),
    assignments,
    status: "draft",
    spreadsheet_url: null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error("シフトを保存できませんでした: " + error.message);

  revalidatePath("/admin/shifts");
  redirect(`/admin/shifts?month=${month}`);
}

// -------------------------------------------------------------
// シフト表の保存（F-18）と完成・スプレッドシート保存（F-19）
// -------------------------------------------------------------

// 画面から送られてきたシフトを、登録済みの従業員・表示名だけに絞って整える
async function sanitizeAssignments(month: string, raw: Assignments) {
  const supabase = await createClient();
  const [{ data: employees }, { data: shiftTypes }] = await Promise.all([
    supabase.from("profiles").select("*").eq("role", "employee").order("created_at"),
    supabase.from("shift_types").select("*").order("start_time"),
  ]);
  const typeIds = new Set((shiftTypes ?? []).map((t) => t.id));
  const days = daysInMonth(month);
  const clean: Assignments = {};
  for (const e of employees ?? []) {
    clean[e.id] = {};
    for (const d of days) {
      const v = raw[e.id]?.[d] ?? null;
      clean[e.id][d] = v === OFF || (v && typeIds.has(v)) ? v : null;
    }
  }
  return {
    supabase,
    clean,
    employees: (employees ?? []) as Profile[],
    shiftTypes: (shiftTypes ?? []) as ShiftType[],
  };
}

export async function saveSchedule(month: string, raw: Assignments): Promise<ActionResult> {
  await requireAdmin();
  const m = normalizeMonth(month);
  const { supabase, clean } = await sanitizeAssignments(m, raw);
  const { error } = await supabase.from("shift_schedules").upsert({
    target_month: monthToDate(m),
    assignments: clean,
    status: "draft",
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, message: "保存に失敗しました: " + error.message };
  revalidatePath("/admin/shifts");
  return { ok: true, message: "下書きを保存しました" };
}

export async function completeSchedule(month: string, raw: Assignments): Promise<ActionResult> {
  await requireAdmin();
  const m = normalizeMonth(month);
  const { supabase, clean, employees, shiftTypes } = await sanitizeAssignments(m, raw);

  // 1. まずアプリ内に保存
  const { error } = await supabase.from("shift_schedules").upsert({
    target_month: monthToDate(m),
    assignments: clean,
    status: "draft",
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, message: "保存に失敗しました: " + error.message };

  // 2. Google スプレッドシートへ書き出し
  let url: string;
  try {
    url = await saveToSpreadsheet({ month: m, employees, shiftTypes, assignments: clean });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      message: "アプリには保存しましたが、スプレッドシートへの保存に失敗しました: " + detail,
    };
  }

  // 3. 完成状態にする
  await supabase
    .from("shift_schedules")
    .update({ status: "completed", spreadsheet_url: url })
    .eq("target_month", monthToDate(m));

  revalidatePath("/admin/shifts");
  return { ok: true, message: "シフトを完成し、スプレッドシートに保存しました", url };
}
