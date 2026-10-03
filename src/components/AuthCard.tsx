// ログイン画面などの、中央寄せのカード枠
export default function AuthCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="card w-full max-w-sm">
        <p className="mb-1 text-center text-sm text-teal-700">シフト自動作成</p>
        <h1 className="mb-6 text-center text-xl font-bold">{title}</h1>
        {children}
      </div>
    </main>
  );
}
