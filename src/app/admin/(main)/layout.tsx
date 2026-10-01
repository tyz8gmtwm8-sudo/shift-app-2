// 管理者画面の共通レイアウト：管理者でなければログイン画面へ
// フォルダ名の (main) は URL に含まれない「グループ用フォルダ」です。
import AppHeader from "@/components/AppHeader";
import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const profile = await requireAdmin();
  return (
    <>
      <AppHeader name={profile.name} homeHref="/admin" role="admin" />
      <main className="mx-auto w-full max-w-7xl flex-1 p-4">{children}</main>
    </>
  );
}
