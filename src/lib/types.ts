// アプリ全体で使う「データの形」の定義

export type ShiftType = {
  id: string;
  name: string;
  color: string;
  start_time: string; // "07:00:00"
  end_time: string;
  required_count: number;
  crosses_midnight: boolean;
  created_at: string;
};

export type Profile = {
  id: string;
  role: "admin" | "employee";
  name: string;
  email: string;
  employment_type: "fulltime" | "parttime" | null;
  monthly_days_off: number | null;
  fixed_weekdays: number[];
  fixed_shift_type_id: string | null;
  created_at: string;
};

export type DayOffRequest = {
  id: string;
  user_id: string;
  target_month: string; // "2026-11-01"
  dates: string[]; // ["2026-11-03", ...]
  message: string | null;
  submitted_at: string;
};

// 休みを表す値
export const OFF = "OFF";

// セルの値: 表示名ID / "OFF"（休み） / null（空欄＝未配置）
export type CellValue = string | null;

// { 従業員ID: { "2026-11-01": セルの値 } }
export type Assignments = Record<string, Record<string, CellValue>>;

export type ShiftSchedule = {
  target_month: string;
  assignments: Assignments;
  status: "draft" | "completed";
  spreadsheet_url: string | null;
  updated_at: string;
};
