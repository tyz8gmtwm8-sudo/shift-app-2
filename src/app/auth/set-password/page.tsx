"use client";
// 招待された従業員が、最初のパスワードを設定する画面（F-07）
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthCard from "@/components/AuthCard";
import { createClient } from "@/lib/supabase/client";

export default function SetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      // 招待メールのリンクが「#access_token=...」形式で届いた場合に対応
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      if (accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        window.history.replaceState(null, "", window.location.pathname); // URL からトークンを消す
      }
      const { data } = await supabase.auth.getUser();
      setHasSession(!!data.user);
      setReady(true);
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("パスワードは8文字以上にしてください");
    if (password !== confirm) return setError("確認用のパスワードが一致しません");

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError("パスワードを設定できませんでした: " + updateError.message);
      setLoading(false);
      return;
    }
    router.push("/"); // 権限に応じたホーム画面へ
    router.refresh();
  }

  if (!ready) {
    return <AuthCard title="パスワード設定"><p className="text-center">確認中…</p></AuthCard>;
  }

  if (!hasSession) {
    return (
      <AuthCard title="パスワード設定">
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          招待リンクが無効か、有効期限が切れています。管理者に招待メールの再送を依頼してください。
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="パスワード設定">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="password">新しいパスワード（8文字以上）</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="confirm">確認のためもう一度</label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            className="input"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button type="submit" className="btn btn-primary w-full" disabled={loading}>
          {loading ? "設定中…" : "パスワードを設定する"}
        </button>
      </form>
    </AuthCard>
  );
}
