"use client";
// Allocation detail (SCR-04-01): every candidate lot in FEFO order with the first rule that excludes it,
// and a prominent warning when a lot would be older than what this customer already received (日付逆転禁止).
import { useState } from "react";
import { sendJson, useApi } from "@/components/use-api";
import { EXCLUSION, EXPIRY, ORDER_STATUS, TERM, WINDOW, ZONE, statusColor } from "@/components/labels";

type Evaluation = { lot: { id: string; lotCode: string; expiryDate: string; mfgDate: string; qtyAvailable: number; locationZone: string; status: string }; excluded: string | null; reason: string; warnings: string[]; deliveryDeadline: string | null };
type PlanResponse = {
  order: { id: string; qty: number; requested_date: string; status: string; customers: { name: string }; customer_id: string; sku_id: string };
  agreement: { id: string; window_rule: string | null; delivery_term: string } | null;
  sku: { name: string; zone: string; expiry_type: string };
  lastReceived: { expiry_date: string; received_at: string } | null;
  plan: { status: string; evaluations: Evaluation[]; picks: { lotId: string; lotCode: string; qty: number }[]; shortBy: number };
};

export function AllocationPlanPanel({ orderId, onChanged }: { orderId: string; onChanged: () => void }) {
  const { data, error, reload } = useApi<PlanResponse>(`/api/orders/${orderId}/plan`);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (error) return <div className="card text-red-600">{error}</div>;
  if (!data) return <div className="card">読み込み中…</div>;
  const { order, agreement, sku, lastReceived, plan } = data;
  const reversal = plan.evaluations.filter((e) => e.excluded === "DATE_REVERSAL");

  async function act(path: "allocate" | "ship") {
    setBusy(true);
    const r = await sendJson(`/api/orders/${orderId}/${path}`);
    setBusy(false);
    setMsg(r.ok ? (path === "allocate" ? (r.json.status === "BUSINESS_REVIEW" ? "業務レビュー保留にしました（納品期限ルール未設定）" : "引当しました") : "納品確定し、納品履歴に記録しました") : r.error);
    reload();
    onChanged();
  }

  return (
    <div className="space-y-3">
      <div className="card text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-bold">{order.id}</span>
          <span className={`badge ${statusColor(order.status)}`}>{ORDER_STATUS[order.status]}</span>
        </div>
        <div className="mt-2 grid gap-1 md:grid-cols-2">
          <div>顧客：{order.customer_id} {order.customers.name}</div>
          <div>SKU：{order.sku_id} {sku.name}（{ZONE[sku.zone]}・{EXPIRY[sku.expiry_type]}）</div>
          <div>数量：{order.qty}　納品日：{order.requested_date}</div>
          <div>契約：{agreement ? `${agreement.id}・${TERM[agreement.delivery_term]}・${agreement.window_rule ? WINDOW[agreement.window_rule] : "納品期限ルール未設定"}` : "契約なし"}</div>
          <div className="md:col-span-2">この顧客×SKU の直近受領ロット期限：<b>{lastReceived ? lastReceived.expiry_date : "履歴なし"}</b></div>
        </div>
      </div>

      {reversal.length > 0 && (
        <div className="card border-red-300 bg-red-50 text-sm text-red-800">
          <b>日付逆転の警告：</b>{order.customer_id} は {sku.name} を期限 {lastReceived?.expiry_date} で受領済みです。
          より古いロット {reversal.map((e) => `${e.lot.lotCode}（${e.lot.expiryDate}）`).join("、")} はこの顧客へ出荷できないため引当対象から除外しました。
        </div>
      )}
      {plan.status === "BUSINESS_REVIEW" && (
        <div className="card border-amber-300 bg-amber-50 text-sm">契約 {agreement?.id} の納品期限ルールが未設定です。既定値を推測せず、業務レビューで設定するまで引当しません。</div>
      )}

      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>順</th><th>ロット</th><th>製造日</th><th>期限</th><th>契約納品期限</th><th>在庫</th><th>判定</th></tr></thead>
          <tbody>
            {plan.evaluations.map((e, i) => {
              const pick = plan.picks.find((p) => p.lotId === e.lot.id);
              return (
                <tr key={e.lot.id} className={e.excluded ? "text-slate-500" : ""}>
                  <td>{i + 1}</td>
                  <td className="font-mono">{e.lot.lotCode}</td>
                  <td>{e.lot.mfgDate}</td>
                  <td>{e.lot.expiryDate}</td>
                  <td>{e.deliveryDeadline ?? "—"}</td>
                  <td>{e.lot.qtyAvailable}</td>
                  <td>
                    {e.excluded ? <span className="badge bg-red-100 text-red-800">{EXCLUSION[e.excluded]}</span>
                      : pick ? <span className="badge bg-emerald-100 text-emerald-800">引当 {pick.qty}</span> : <span className="badge bg-slate-100">候補</span>}
                    <div className="text-xs">{e.excluded ? e.reason : ""}{e.warnings.map((w) => <div key={w} className="text-amber-700">⚠ {w}</div>)}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-slate-500">除外順序：①消費期限 → ②温度帯 → ③隔離 → ④契約納品期限 → ⑤日付逆転 → 残りを FEFO（同期限は入荷順）で引当</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn" disabled={busy || order.status !== "OPEN"} onClick={() => act("allocate")}>引当実行</button>
        <button className="btn-secondary" disabled={busy || order.status !== "ALLOCATED"} onClick={() => act("ship")}>納品確定（POD はモック）</button>
        {plan.status === "SHORT" && <span className="text-sm text-amber-700">引当可能数量が {plan.shortBy} 不足しています</span>}
        {msg && <span className="text-sm">{msg}</span>}
      </div>
    </div>
  );
}
