// 管理者ホーム（F-02）：4つのボタン
import Link from "next/link";

const MENU = [
  { href: "/admin/generate", title: "自動作成", desc: "希望休の提出状況を確認して、シフトを自動生成", icon: "⚙️" },
  { href: "/admin/shifts", title: "シフト表表示", desc: "シフト表の確認・手動修正・完成", icon: "📅" },
  { href: "/admin/employees", title: "従業員設定", desc: "従業員の登録と、社員／パートの勤務条件", icon: "👥" },
  { href: "/admin/shift-types", title: "表示名設定", desc: "早番・夜勤などの名前・色・時間・必要人数", icon: "🏷️" },
];

export default function AdminHomePage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-xl font-bold">管理者ホーム</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {MENU.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="card flex items-start gap-4 transition hover:border-teal-400 hover:shadow-md"
          >
            <span className="text-3xl" aria-hidden>{m.icon}</span>
            <span>
              <span className="block text-lg font-bold text-teal-700">{m.title}</span>
              <span className="mt-1 block text-sm text-slate-600">{m.desc}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
