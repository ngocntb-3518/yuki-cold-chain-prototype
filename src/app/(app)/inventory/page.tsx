"use client";
// Inventory and quarantine (SCR-03-07 / SCR-03-06): QC releases or scraps quarantined lots with a mandatory rationale
import { useState } from "react";
import { sendJson, useApi } from "@/components/use-api";
import { EXPIRY, LOT_STATUS, ZONE, fmtDateTime, statusColor } from "@/components/labels";

type Lot = {
  id: string; lot_code: string; sku_id: string; supplier: string; expiry_date: string; qty_available: number; qty_received: number;
  location: string; status: string; beef_id: string | null; rice_origin: string | null; received_at: string;
  skus: { name: string; zone: string; expiry_type: string };
};

export default function InventoryPage() {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const { data, error, reload } = useApi<{ lots: Lot[] }>(`/api/lots?status=${status}&q=${encodeURIComponent(q)}`);
  const [msg, setMsg] = useState<string | null>(null);

  async function decide(lot: Lot, action: "RELEASE" | "SCRAP") {
    const rationale = prompt(`${lot.lot_code} を${action === "RELEASE" ? "隔離解除" : "廃棄"}します。判定理由を入力してください（必須）`);
    if (rationale === null) return;
    const r = await sendJson(`/api/lots/${lot.id}`, { action, rationale }, "PATCH");
    setMsg(r.ok ? `${lot.lot_code}：${action === "RELEASE" ? "隔離解除" : "廃棄"}しました` : r.error);
    reload();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">在庫・隔離</h1>
      <div className="card flex flex-wrap gap-3">
        <select className="input max-w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">全状態</option>
          {Object.entries(LOT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input className="input max-w-60" placeholder="ロット番号で検索" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {(error || msg) && <p className="text-sm text-amber-700">{error ?? msg}</p>}
      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr><th>ロット</th><th>SKU</th><th>温度帯</th><th>期限</th><th>在庫/受入</th><th>ロケーション</th><th>状態</th><th>識別子</th><th>入荷</th><th>品質判定</th></tr>
          </thead>
          <tbody>
            {data?.lots.map((l) => (
              <tr key={l.id}>
                <td className="font-mono">{l.lot_code}</td>
                <td>{l.sku_id}<div className="text-xs text-slate-500">{l.skus.name}</div></td>
                <td>{ZONE[l.skus.zone]}</td>
                <td>{l.expiry_date}<div className="text-xs text-slate-500">{EXPIRY[l.skus.expiry_type]}</div></td>
                <td>{l.qty_available} / {l.qty_received}</td>
                <td>{l.location}</td>
                <td><span className={`badge ${statusColor(l.status)}`}>{LOT_STATUS[l.status]}</span></td>
                <td className="text-xs">{l.beef_id ? `牛 ${l.beef_id}` : l.rice_origin ? `米 ${l.rice_origin}` : "—"}</td>
                <td className="text-xs">{fmtDateTime(l.received_at)}</td>
                <td className="space-x-1 whitespace-nowrap">
                  {l.status === "QUARANTINE" && (
                    <>
                      <button className="btn-secondary" onClick={() => decide(l, "RELEASE")}>解除</button>
                      <button className="btn-secondary" onClick={() => decide(l, "SCRAP")}>廃棄</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
