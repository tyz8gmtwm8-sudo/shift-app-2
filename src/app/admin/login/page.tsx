// 管理者ログイン画面（F-01）
import Link from "next/link";
import AuthCard from "@/components/AuthCard";
import LoginForm from "@/components/LoginForm";

export default function AdminLoginPage() {
  return (
    <AuthCard title="管理者ログイン">
      <LoginForm role="admin" />
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="text-slate-500 underline">
          従業員の方はこちら
        </Link>
      </p>
    </AuthCard>
  );
}
