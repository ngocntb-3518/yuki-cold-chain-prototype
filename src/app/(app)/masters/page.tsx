"use client";
// Master data view (SCR-01-01 / SCR-01-03 / SCR-01-06, read-only in the prototype)
import { useApi } from "@/components/use-api";
import { EXPIRY, TERM, WINDOW, ZONE } from "@/components/labels";

type Masters = {
  skus: { id: string; name: string; unit: string; zone: string; expiry_type: string; trace_lane: string }[];
  agreements: { id: string; customer_id: string; sku_id: string; delivery_term: string; window_rule: string | null; customers: { name: string }; skus: { name: string } }[];
  policies: { zone: string; min_c: number | null; max_c: number; policy_version: string; effective_from: string }[];
};

export default function MastersPage() {
  const { data, error } = useApi<Masters>("/api/masters");
  if (error) return <p className="text-red-600">{error}</p>;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">マスタ（参照のみ）</h1>
      <div className="card">
        <h2 className="mb-2 font-semibold">温度ポリシー（貴社独自・版管理）</h2>
        <table className="tbl"><thead><tr><th>温度帯</th><th>閾値</th><th>版</th><th>有効日</th></tr></thead>
          <tbody>{data?.policies.map((p) => <tr key={p.zone}><td>{ZONE[p.zone]}</td><td>{p.min_c === null ? `≤${p.max_c}℃` : `${p.min_c}〜${p.max_c}℃`}</td><td>{p.policy_version}</td><td>{p.effective_from}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="card overflow-x-auto">
        <h2 className="mb-2 font-semibold">SKU（RFP R-02 の12品目）</h2>
        <table className="tbl"><thead><tr><th>SKU</th><th>名称</th><th>単位</th><th>温度帯</th><th>期限種別</th><th>トレース</th></tr></thead>
          <tbody>{data?.skus.map((s) => <tr key={s.id}><td>{s.id}</td><td>{s.name}</td><td>{s.unit}</td><td>{ZONE[s.zone]}</td><td>{EXPIRY[s.expiry_type]}</td><td>{s.trace_lane === "rice" ? "米（法定）" : s.trace_lane === "beef" ? "牛（法定）" : "社内ロット"}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="card overflow-x-auto">
        <h2 className="mb-2 font-semibold">顧客×SKU 契約（RFP R-04、1/3・1/2ルールは商慣習であり法律ではない）</h2>
        <table className="tbl"><thead><tr><th>契約</th><th>顧客</th><th>SKU</th><th>受渡条件</th><th>納品期限ルール</th></tr></thead>
          <tbody>{data?.agreements.map((a) => (
            <tr key={a.id}><td>{a.id}</td><td>{a.customer_id} {a.customers.name}</td><td>{a.sku_id} {a.skus.name}</td><td>{TERM[a.delivery_term]}</td>
              <td>{a.window_rule ? WINDOW[a.window_rule] : <span className="badge bg-amber-100 text-amber-800">未設定 → 業務レビュー</span>}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
