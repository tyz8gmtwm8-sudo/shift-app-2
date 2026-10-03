// 表示名設定画面（F-10, F-11）
import ShiftTypeManager from "@/components/ShiftTypeManager";
import { createClient } from "@/lib/supabase/server";
import type { ShiftType } from "@/lib/types";

export default async function ShiftTypesPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("shift_types").select("*").order("start_time");
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-2 text-xl font-bold">表示名設定</h1>
      <p className="mb-6 text-sm text-slate-600">
        早番・日勤・夜勤などの勤務区分を登録します。「日をまたぐ」にチェックすると、その勤務の翌日は自動で休みになります。
      </p>
      <ShiftTypeManager shiftTypes={(data ?? []) as ShiftType[]} />
    </div>
  );
}
