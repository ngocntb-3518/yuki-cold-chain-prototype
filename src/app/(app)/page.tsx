"use client";
// Home (SCR-00-02): what is waiting for action right now
import Link from "next/link";
import { useApi } from "@/components/use-api";

type Counts = { alarms: number; quarantine: number; openOrders: number; review: number; draftRoutes: number };

export default function Home() {
  const { data, error } = useApi<Counts>("/api/dashboard");
  const tiles: [keyof Counts, string, string, string][] = [
    ["alarms", "未レビューの温度警報", "/alarms", "15分以内に初回レビュー"],
    ["quarantine", "隔離中ロット", "/inventory", "品質管理の判定待ち"],
    ["openOrders", "未引当の受注", "/allocation", "引当ルールで自動判定"],
    ["review", "業務レビュー保留", "/allocation", "納品期限ルール未設定の契約"],
    ["draftRoutes", "未公開ルート", "/routes", "拘束時間チェック後に公開"],
  ];
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">ホーム</h1>
      {error && <p className="text-red-600">{error}</p>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {tiles.map(([key, label, href, hint]) => (
          <Link key={key} href={href} className="card hover:border-sky-400">
            <div className="text-3xl font-bold text-sky-800">{data ? data[key] : "…"}</div>
            <div className="mt-1 font-semibold">{label}</div>
            <div className="text-xs text-slate-500">{hint}</div>
          </Link>
        ))}
      </div>
      <div className="card text-sm text-slate-600">
        プロトタイプ：データはすべてモック（RFP の fixture を基に作成）。業務の流れ — 入荷検品 → 在庫・隔離 → 引当（消費期限 → 温度帯 → 隔離 → 契約納品期限 → 日付逆転 → FEFO）→ 納品確定 → 納品履歴。
      </div>
    </div>
  );
}
