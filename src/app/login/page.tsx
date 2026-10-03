// 従業員ログイン画面（F-03）
import Link from "next/link";
import AuthCard from "@/components/AuthCard";
import LoginForm from "@/components/LoginForm";

export default function EmployeeLoginPage() {
  return (
    <AuthCard title="従業員ログイン">
      <LoginForm role="employee" />
      <p className="mt-6 text-center text-sm">
        <Link href="/admin/login" className="text-slate-500 underline">
          管理者の方はこちら
        </Link>
      </p>
    </AuthCard>
  );
}
