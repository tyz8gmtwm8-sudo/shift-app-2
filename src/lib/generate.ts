// =============================================================
// シフト自動生成ロジック（要件 F-15）
//   1. 提出された希望休の日は休みにする
//   2. 日またぎの表示名に入った翌日は休みにする
//   3. パートは固定出勤曜日に、固定の表示名で配置する
//   4. 社員は月間休日数どおりに休みを割り当て、残りの日に各表示名を均等に配置する
//   5. 配置しきれない枠は空欄のまま（シフト表で赤表示）
// =============================================================
import { daysInMonth, weekdayOf } from "./date";
import {
  OFF,
  type Assignments,
  type CellValue,
  type DayOffRequest,
  type Profile,
  type ShiftType,
} from "./types";

export type GenerateInput = {
  month: string; // "YYYY-MM"
  employees: Profile[]; // 登録が早い順に並んだ従業員
  shiftTypes: ShiftType[];
  requests: DayOffRequest[];
  // 前月末日の勤務（前月末が夜勤なら当月1日を休みにするため）{ 従業員ID: セルの値 }
  previousLastDay?: Record<string, CellValue>;
};

export function generateSchedule(input: GenerateInput): Assignments {
  const { month, employees, shiftTypes, requests, previousLastDay = {} } = input;
  const days = daysInMonth(month);
  const typeById = new Map(shiftTypes.map((t) => [t.id, t]));
  const isCrossing = (id: CellValue) => !!id && !!typeById.get(id)?.crosses_midnight;

  // ---- 準備: 全員・全日を空欄(null)にする ----
  const grid: Assignments = {};
  for (const e of employees) {
    grid[e.id] = Object.fromEntries(days.map((d) => [d, null]));
  }

  // 日付ごと・表示名ごとの配置人数
  const count: Record<string, Record<string, number>> = {};
  for (const d of days) count[d] = Object.fromEntries(shiftTypes.map((t) => [t.id, 0]));

  // 空欄なら休みにする
  const setOffIfEmpty = (userId: string, dayIndex: number) => {
    const d = days[dayIndex];
    if (d && grid[userId][d] === null) grid[userId][d] = OFF;
  };

  // 勤務を割り当てる（日またぎなら翌日を休みに）
  const assign = (userId: string, dayIndex: number, typeId: string) => {
    const d = days[dayIndex];
    grid[userId][d] = typeId;
    count[d][typeId] += 1;
    if (isCrossing(typeId)) setOffIfEmpty(userId, dayIndex + 1);
  };

  // ---- 前月末が日またぎ勤務なら、当月1日を休みに（ルール2） ----
  for (const e of employees) {
    if (isCrossing(previousLastDay[e.id] ?? null)) setOffIfEmpty(e.id, 0);
  }

  // ---- ルール1: 希望休 ----
  const employeeIds = new Set(employees.map((e) => e.id));
  for (const r of requests) {
    if (!employeeIds.has(r.user_id)) continue;
    for (const d of r.dates) {
      if (d in grid[r.user_id]) grid[r.user_id][d] = OFF;
    }
  }

  // ---- ルール3: パート ----
  const partTimers = employees.filter((e) => e.employment_type === "parttime");
  for (const p of partTimers) {
    const fixedType = p.fixed_shift_type_id ? typeById.get(p.fixed_shift_type_id) : undefined;
    days.forEach((d, i) => {
      if (grid[p.id][d] !== null) return; // 希望休・夜勤明けはそのまま
      if (fixedType && p.fixed_weekdays.includes(weekdayOf(d))) {
        assign(p.id, i, fixedType.id);
      } else {
        grid[p.id][d] = OFF; // 固定曜日以外は休み
      }
    });
  }

  // ---- ルール4: 社員 ----
  const fullTimers = employees.filter((e) => e.employment_type !== "parttime");
  const order = new Map(employees.map((e, i) => [e.id, i]));
  const workTarget = new Map(
    fullTimers.map((e) => [e.id, Math.max(0, days.length - (e.monthly_days_off ?? 0))]),
  );
  const worked = new Map(fullTimers.map((e) => [e.id, 0]));
  const typeCount = new Map(
    fullTimers.map((e) => [e.id, Object.fromEntries(shiftTypes.map((t) => [t.id, 0]))]),
  );

  // まだ予定が決まっていない（空欄の）日数。第2段階でどの空欄にも出勤を入れられるので月全体で数える
  const freeDays = (userId: string) => days.filter((d) => grid[userId][d] === null).length;
  const remainingWork = (userId: string) => workTarget.get(userId)! - worked.get(userId)!;
  // 「残り出勤日数 ÷ 空欄の日数」：1 に近いほど休日の余裕がない
  const urgency = (userId: string) => {
    const free = freeDays(userId);
    return free === 0 ? 0 : remainingWork(userId) / free;
  };

  // この人をこの日・この表示名に入れられるか
  const canWork = (userId: string, dayIndex: number, type: ShiftType) => {
    const d = days[dayIndex];
    if (grid[userId][d] !== null) return false;
    if (remainingWork(userId) <= 0) return false; // 出勤日数を使い切った
    if (type.crosses_midnight) {
      const next = days[dayIndex + 1];
      if (next === undefined) return true; // 月末（翌月1日は翌月の生成で休みになる）
      const nextValue = grid[userId][next];
      if (nextValue === OFF) return true; // 翌日はもともと休み
      if (nextValue !== null) return false; // 翌日に勤務が入っている
      // 翌日が休みになるので、休日数に1日の余裕が必要
      return freeDays(userId) - remainingWork(userId) >= 1;
    }
    return true;
  };

  const record = (userId: string, dayIndex: number, typeId: string) => {
    assign(userId, dayIndex, typeId);
    worked.set(userId, worked.get(userId)! + 1);
    typeCount.get(userId)![typeId] += 1;
  };

  // 日またぎ（条件が厳しい）→ 開始時刻が早い順 に埋める
  const orderedTypes = [...shiftTypes].sort((a, b) => {
    if (a.crosses_midnight !== b.crosses_midnight) return a.crosses_midnight ? -1 : 1;
    return a.start_time.localeCompare(b.start_time);
  });

  // (第1段階) 月全体で、各日の必要人数を埋める
  days.forEach((d, i) => {
    for (const type of orderedTypes) {
      let need = type.required_count - count[d][type.id];
      while (need > 0) {
        const candidates = fullTimers.filter((e) => canWork(e.id, i, type));
        if (candidates.length === 0) break; // 埋められない → 空欄のまま（ルール5）
        // 休日を使い切っていて残り全部出勤が必要な人
        const mustWork = (id: string) => (urgency(id) >= 1 ? 1 : 0);
        candidates.sort(
          (a, b) =>
            mustWork(b.id) - mustWork(a.id) ||
            typeCount.get(a.id)![type.id] - typeCount.get(b.id)![type.id] || // 同じ表示名が少ない人（均等化）
            urgency(b.id) - urgency(a.id) || // 出勤が詰まりそうな人
            worked.get(a.id)! - worked.get(b.id)! || // 出勤が少ない人
            order.get(a.id)! - order.get(b.id)!, // 登録が早い人
        );
        record(candidates[0].id, i, type.id);
        need -= 1;
      }
    }
  });

  // (第2段階) 社員の残りの出勤日数を、人が手薄な日から順に割り振る
  const totalRequired = shiftTypes.reduce((sum, t) => sum + Math.max(t.required_count, 1), 0);
  const staffingRatio = (d: string) =>
    shiftTypes.reduce((sum, t) => sum + count[d][t.id], 0) / Math.max(totalRequired, 1);

  for (const e of fullTimers) {
    while (remainingWork(e.id) > 0) {
      // 出勤できる表示名がある空欄の日を候補にする
      const options = days
        .map((d, i) => ({ d, i }))
        .filter(({ d, i }) => grid[e.id][d] === null && shiftTypes.some((t) => canWork(e.id, i, t)));
      if (options.length === 0) break;
      options.sort((a, b) => staffingRatio(a.d) - staffingRatio(b.d) || a.i - b.i);
      const { d, i } = options[0];
      // 必要人数に対して配置が少ない表示名へ（日またぎは翌日が休みになるので後回し）
      const type = shiftTypes
        .filter((t) => canWork(e.id, i, t))
        .sort(
          (a, b) =>
            Number(a.crosses_midnight) - Number(b.crosses_midnight) ||
            count[d][a.id] / Math.max(a.required_count, 1) -
              count[d][b.id] / Math.max(b.required_count, 1) ||
            typeCount.get(e.id)![a.id] - typeCount.get(e.id)![b.id],
        )[0];
      record(e.id, i, type.id);
    }
  }

  // 念のため、残った空欄は休みにする
  for (const e of employees) {
    for (const d of days) if (grid[e.id][d] === null) grid[e.id][d] = OFF;
  }
  return grid;
}

// =============================================================
// 不足人数の計算（要件 F-17）
//   戻り値: { 日付: { 表示名ID: 配置人数 } }
// =============================================================
export function countByDay(
  assignments: Assignments,
  days: string[],
  shiftTypes: ShiftType[],
): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {};
  for (const d of days) {
    result[d] = Object.fromEntries(shiftTypes.map((t) => [t.id, 0]));
  }
  for (const row of Object.values(assignments)) {
    for (const d of days) {
      const v = row[d];
      if (v && v !== OFF && result[d][v] !== undefined) result[d][v] += 1;
    }
  }
  return result;
}
