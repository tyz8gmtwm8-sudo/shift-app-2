// 従業員設定画面（F-07〜F-09）
import EmployeeManager from "@/components/EmployeeManager";
import { createClient } from "@/lib/supabase/server";
import type { Profile, ShiftType } from "@/lib/types";

export default async function EmployeesPage() {
  const supabase = await createClient();
  const [{ data: employees }, { data: shiftTypes }] = await Promise.all([
    supabase.from("profiles").select("*").eq("role", "employee").order("created_at"),
    supabase.from("shift_types").select("*").order("start_time"),
  ]);
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-2 text-xl font-bold">従業員設定</h1>
      <p className="mb-6 text-sm text-slate-600">
        登録すると、入力したメールアドレスに招待メールが届きます。本人がメールのリンクからパスワードを設定するとログインできるようになります。
      </p>
      <EmployeeManager
        employees={(employees ?? []) as Profile[]}
        shiftTypes={(shiftTypes ?? []) as ShiftType[]}
      />
    </div>
  );
}
