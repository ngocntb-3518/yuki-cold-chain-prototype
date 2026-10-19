"use client";
// Accepted delivery history per customer x SKU (SCR-04-03) — the reference data of 日付逆転禁止
import { useState } from "react";
import { useApi } from "@/components/use-api";
import { fmtDateTime } from "@/components/labels";

type Row = { id: string; customer_id: string; sku_id: string; expiry_date: string; received_at: string; source: string; customers: { name: string }; skus: { name: string }; lots: { lot_code: string } | null };

export default function HistoryPage() {
  const [customer, setCustomer] = useState("");
  const [sku, setSku] = useState("");
  const { data, error } = useApi<{ history: Row[] }>(`/api/history?customer=${customer}&sku=${sku}`);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">納品履歴（受領済み）</h1>
      <div className="card flex flex-wrap gap-3">
        <input className="input max-w-40" placeholder="顧客 例 CUS-003" value={customer} onChange={(e) => setCustomer(e.target.value.toUpperCase())} />
        <input className="input max-w-40" placeholder="SKU 例 CHI-002" value={sku} onChange={(e) => setSku(e.target.value.toUpperCase())} />
        <span className="self-center text-xs text-slate-500">履歴は追記のみ（訂正は取消イベントで行う設計。プロトタイプでは訂正機能は対象外）</span>
      </div>
      {error && <p className="text-red-600">{error}</p>}
      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>受領日時</th><th>顧客</th><th>SKU</th><th>ロット</th><th>期限</th><th>出所</th></tr></thead>
          <tbody>
            {data?.history.map((h) => (
              <tr key={h.id}>
                <td>{fmtDateTime(h.received_at)}</td>
                <td>{h.customer_id}<div className="text-xs text-slate-500">{h.customers.name}</div></td>
                <td>{h.sku_id}<div className="text-xs text-slate-500">{h.skus.name}</div></td>
                <td className="font-mono">{h.lots?.lot_code ?? "—"}</td>
                <td className="font-semibold">{h.expiry_date}</td>
                <td className="text-xs">{h.source === "MIGRATED" ? "移行データ（モック）" : "システム"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
