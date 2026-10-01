-- =============================================================
-- 最初の管理者を登録する SQL
-- 1. Supabase の「Authentication」→「Users」→「Add user」→「Create new user」で
--    管理者のメールアドレスとパスワードを入力して作成（Auto Confirm User にチェック）
-- 2. 下の 'admin@example.com' を、そのメールアドレスに書き換えて「Run」
-- =============================================================
insert into public.profiles (id, role, name, email)
select id, 'admin', '管理者', email
from auth.users
where email = 'admin@example.com'
on conflict (id) do update set role = 'admin';
