# 介護施設向け 自動シフト作成アプリ

従業員がスマホから希望休を提出し、管理者がボタンひとつでシフトを自動生成できる Web アプリです。
要件は [requirements.md](requirements.md) を参照してください。

- 技術: Next.js 16 / Supabase（ログイン・データベース）/ Vercel（公開）/ Google Sheets API（保存）
- 主な画面
  - 従業員: `/login` → `/employee`（希望休カレンダー）
  - 管理者: `/admin/login` → `/admin`（自動作成・シフト表・従業員設定・表示名設定）

## フォルダ構成

```
supabase/schema.sql        … データベースの定義（テーブル・アクセス制限）
supabase/create-admin.sql  … 最初の管理者を登録する SQL
src/lib/generate.ts        … シフト自動生成ロジック
src/lib/sheets.ts          … Google スプレッドシートへの保存
src/app/admin/actions.ts   … 管理者の保存・削除・生成などのサーバー処理
src/app/employee/          … 従業員の希望休画面
src/app/admin/(main)/      … 管理者の各画面
src/components/            … 画面の部品
```

---

## セットアップ手順

> 画面の名前やボタンの位置は 2026年8月時点のものです。サービス側の更新で変わっている場合があります。

### 1. Supabase の準備

1. https://supabase.com にログインし、「New project」でプロジェクトを作成（Region は Tokyo 推奨）
2. 左メニュー「SQL Editor」→ `supabase/schema.sql` の中身を全部貼り付けて「Run」
3. 左メニュー「Authentication」→「Sign In / Providers」で
   - **「Allow new users to sign up」をオフ**（勝手に登録されないように。従業員は管理者の招待で登録します）
4. 「Authentication」→「URL Configuration」で
   - Site URL: `http://localhost:3000`（公開後は Vercel の URL に変更）
   - Redirect URLs に `http://localhost:3000/**` と、公開後は `https://あなたのアプリ.vercel.app/**` を追加
5. （推奨）「Authentication」→「Emails」→「Invite user」テンプレートのリンク部分を次に変更
   ```html
   <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite">パスワードを設定する</a>
   ```
   ※ 変更しなくても動くように作っていますが、こちらの方が確実です。
6. ⚠️ **メール送信について**: Supabase 標準のメール送信は、送信数が非常に少なく、送信先もプロジェクトのメンバーに限られる場合があります。
   実際に従業員へ招待メールを送るには「Authentication」→「Emails」→「SMTP Settings」で外部のメール送信サービス（例: Resend の無料枠）を設定してください。

### 2. 最初の管理者を作る

1. 「Authentication」→「Users」→「Add user」→「Create new user」
   - 管理者のメールアドレスとパスワードを入力し、「Auto Confirm User」にチェックして作成
2. 「SQL Editor」で `supabase/create-admin.sql` を開き、`admin@example.com` を上のメールアドレスに書き換えて「Run」

### 3. Google スプレッドシートの準備

「サービスアカウント」＝アプリ専用の Google ロボットアカウントを作り、スプレッドシートを編集できるようにします。

1. https://console.cloud.google.com で新しいプロジェクトを作成
2. 「API とサービス」→「ライブラリ」→「Google Sheets API」を検索して「有効にする」
3. 「API とサービス」→「認証情報」→「認証情報を作成」→「サービスアカウント」→ 名前を入れて作成
4. 作成したサービスアカウントを開き、「鍵」タブ →「鍵を追加」→「新しい鍵を作成」→「JSON」→ ファイルがダウンロードされます
   - ⚠️ この JSON は秘密情報です。GitHub に上げたり、人に送ったりしないでください
5. 保存先にする Google スプレッドシートを新しく作り、右上「共有」からサービスアカウントのメールアドレス（`〜@〜.iam.gserviceaccount.com`）を **編集者** で追加

### 4. 環境変数の設定とローカル起動

プロジェクトのフォルダ（`shift-app-2`）で実行します。

```bash
cp .env.example .env.local
```

`.env.local` をエディタで開き、各値を書き換えます。

| 変数名 | どこで確認するか |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase「Project Settings」→「Data API」の Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase「Project Settings」→「API Keys」の Publishable key |
| `SUPABASE_SECRET_KEY` | 同じ画面の Secret key（**絶対に公開しない**） |
| `NEXT_PUBLIC_SITE_URL` | ローカルは `http://localhost:3000` |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | JSON の `client_email` |
| `GOOGLE_PRIVATE_KEY` | JSON の `private_key`（`"` で囲んだまま 1 行で） |
| `GOOGLE_SPREADSHEET_ID` | スプレッドシート URL の `/d/` と `/edit` の間 |

```bash
npm install
npm run dev
```

ブラウザで http://localhost:3000/admin/login を開き、管理者でログインします。

### 5. 使い方の流れ

1. **表示名設定**: 早番・日勤・夜勤などを登録（夜勤は「日をまたぐ」にチェック）
2. **従業員設定**: 従業員を登録 → 招待メールが届き、本人がパスワードを設定
3. 従業員が `/login` からログインし、希望休を提出
4. **自動作成**: 提出状況を確認し「シフトを自動生成する」
5. **シフト表**: 赤い所（人員不足）をセルをタップして手動修正 →「完成」でスプレッドシートに保存

### 6. Vercel で公開

1. GitHub にプッシュ
2. https://vercel.com で「Add New…」→「Project」→ リポジトリを選んで Import
3. 「Environment Variables」に `.env.local` と同じ値を登録（`NEXT_PUBLIC_SITE_URL` は Vercel の URL に）
4. 「Deploy」
5. Supabase の Site URL / Redirect URLs を Vercel の URL に更新

---

## 自動生成のルール

1. 提出された希望休の日は休み
2. 日またぎの表示名（夜勤など）の翌日は休み（前月末の夜勤明けも考慮）
3. パートは固定出勤曜日に、固定の表示名で配置（それ以外の日は休み）
4. 社員は月間休日数どおりに休みを割り当て、まず各日の必要人数を埋め、残りの出勤日を人が手薄な日へ均等に配置
5. 配置しきれない枠は空欄のまま → シフト表で赤表示

## 未決事項

- 希望休の提出締切（現在は締切なし。提出後もいつでも更新できます）
