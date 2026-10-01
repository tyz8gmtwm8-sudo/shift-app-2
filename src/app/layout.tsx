import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "シフト自動作成",
  description: "介護施設向け 自動シフト作成アプリ",
};

// スマートフォンで正しい幅で表示するための設定
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
