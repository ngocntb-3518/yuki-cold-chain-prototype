import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yuki コールドチェーン（プロトタイプ）",
  description: "食品コールドチェーン業務支援システム LAB-2 プロトタイプ",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body className="bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
