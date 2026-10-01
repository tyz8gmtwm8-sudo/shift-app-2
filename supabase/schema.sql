-- =============================================================
-- 自動シフト作成アプリ データベース定義
-- Supabase の「SQL Editor」に全文を貼り付けて「Run」してください。
-- =============================================================

-- -------------------------------------------------------------
-- 1. 表示名（勤務区分）: 早番・日勤・夜勤など
-- -------------------------------------------------------------
create table if not exists public.shift_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,                         -- 表示名（例: 早番）
  color text not null default '#60a5fa',      -- 表示色（例: #60a5fa）
  start_time time not null,                   -- 勤務開始
  end_time time not null,                     -- 勤務終了
  required_count int not null default 1 check (required_count >= 0), -- 1日あたりの必要人数
  crosses_midnight boolean not null default false, -- 日をまたぐか（翌日は自動で休み）
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------
-- 2. プロフィール（管理者・従業員）
--    auth.users（Supabase のログイン用ユーザー）と 1対1 で紐づく
-- -------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'employee' check (role in ('admin', 'employee')),
  name text not null,
  email text not null,
  employment_type text check (employment_type in ('fulltime', 'parttime')), -- 社員 / パート
  monthly_days_off int check (monthly_days_off >= 0),      -- 社員: 月間休日数
  fixed_weekdays int[] not null default '{}',              -- パート: 固定出勤曜日（0=日 … 6=土）
  fixed_shift_type_id uuid references public.shift_types (id) on delete set null, -- パート: 固定の表示名
  created_at timestamptz not null default now()             -- 登録日時（シフト表の並び順に使用）
);

-- -------------------------------------------------------------
-- 3. 希望休（従業員 × 対象月 で 1 件）
-- -------------------------------------------------------------
create table if not exists public.day_off_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  target_month date not null,                 -- 対象月（その月の1日。例: 2026-11-01）
  dates date[] not null default '{}',         -- 希望休の日付一覧
  message text,                               -- 管理者へのメッセージ（任意）
  submitted_at timestamptz not null default now(),
  unique (user_id, target_month)
);

-- -------------------------------------------------------------
-- 4. シフト表（対象月ごとに 1 件。中身は JSON で保存）
--    assignments の形: { "従業員ID": { "2026-11-01": "表示名ID" or "OFF" } }
-- -------------------------------------------------------------
create table if not exists public.shift_schedules (
  target_month date primary key,
  assignments jsonb not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'completed')),
  spreadsheet_url text,
  updated_at timestamptz not null default now()
);

-- -------------------------------------------------------------
-- 5. 管理者かどうかを判定する関数
--    security definer = RLS を通らずに profiles を読めるようにする（無限ループ防止）
-- -------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- -------------------------------------------------------------
-- 6. RLS（行レベルセキュリティ）
-- -------------------------------------------------------------
alter table public.shift_types enable row level security;
alter table public.profiles enable row level security;
alter table public.day_off_requests enable row level security;
alter table public.shift_schedules enable row level security;

-- 表示名: ログインしていれば閲覧可 / 変更は管理者のみ
drop policy if exists "shift_types_select" on public.shift_types;
create policy "shift_types_select" on public.shift_types
  for select to authenticated using (true);
drop policy if exists "shift_types_admin_write" on public.shift_types;
create policy "shift_types_admin_write" on public.shift_types
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- プロフィール: 自分の行は閲覧可 / 管理者はすべて操作可
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles_admin_write" on public.profiles;
create policy "profiles_admin_write" on public.profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 希望休: 従業員は自分の分のみ閲覧・作成・更新 / 管理者は全員分を閲覧
drop policy if exists "requests_select" on public.day_off_requests;
create policy "requests_select" on public.day_off_requests
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "requests_insert_own" on public.day_off_requests;
create policy "requests_insert_own" on public.day_off_requests
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "requests_update_own" on public.day_off_requests;
create policy "requests_update_own" on public.day_off_requests
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- シフト表: 管理者のみ
drop policy if exists "schedules_admin_all" on public.shift_schedules;
create policy "schedules_admin_all" on public.shift_schedules
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
