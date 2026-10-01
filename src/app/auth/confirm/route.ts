// 招待メールのリンクを押したときの受け口
// メール内のトークンを確認してログイン状態にし、パスワード設定画面へ移動します。
import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}/auth/set-password`);
  }
  return NextResponse.redirect(`${origin}/auth/set-password?error=invalid`);
}
