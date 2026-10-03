// 管理用 Supabase クライアント（招待メール送信・ユーザー削除に使用）
// ⚠️ シークレットキーは RLS を無視できる強い鍵です。サーバー側だけで使い、
//    "NEXT_PUBLIC_" を付けない（＝ブラウザに送らない）環境変数に入れてください。
import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
