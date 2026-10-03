// 画面上部のヘッダー（タイトル・ユーザー名・ログアウト）
import Link from "next/link";
import { signOut } from "@/app/actions/auth";

export default function AppHeader({
  name,
  homeHref,
  role,
}: {
  name: string;
  homeHref: string;
  role: "admin" | "employee";
}) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
        <Link href={homeHref} className="font-bold text-teal-700">
          シフト自動作成{role === "admin" && <span className="ml-2 text-xs text-slate-500">管理者</span>}
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-slate-600 sm:inline">{name} さん</span>
          <form action={signOut}>
            <input type="hidden" name="to" value={role} />
            <button type="submit" className="btn btn-secondary px-3 py-1 text-sm">
              ログアウト
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
