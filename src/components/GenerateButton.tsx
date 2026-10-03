"use client";
// シフト自動生成ボタン（既存のシフトがある場合は上書き確認）
import { useFormStatus } from "react-dom";

export default function GenerateButton({ hasExisting }: { hasExisting: boolean }) {
  const { pending } = useFormStatus(); // フォーム送信中かどうか
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn btn-primary px-8 py-3 text-lg"
      onClick={(e) => {
        if (hasExisting && !confirm("この月のシフトはすでに作成されています。作り直して上書きしますか？\n（手動で修正した内容は消えます）")) {
          e.preventDefault();
        }
      }}
    >
      {pending ? "生成中…" : "シフトを自動生成する"}
    </button>
  );
}
