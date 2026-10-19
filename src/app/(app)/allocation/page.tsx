"use client";
// Orders and allocation (SCR-05-01 + SCR-04-01)
import { useState } from "react";
import { useApi } from "@/components/use-api";
import { AllocationPlanPanel } from "@/components/allocation-plan-panel";
import { ORDER_STATUS, statusColor } from "@/components/labels";

type Order = { id: string; customer_id: string; sku_id: string; qty: number; requested_date: string; status: string; customers: { name: string }; skus: { name: string } };

export default function AllocationPage() {
  const { data, error, reload } = useApi<{ orders: Order[] }>("/api/orders");
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">引当・出荷</h1>
      {error && <p className="text-red-600">{error}</p>}
      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>受注</th><th>顧客 / SKU</th><th>数量</th><th>状態</th></tr></thead>
            <tbody>
              {data?.orders.map((o) => (
                <tr key={o.id} onClick={() => setSelected(o.id)} className={`cursor-pointer hover:bg-sky-50 ${selected === o.id ? "bg-sky-50" : ""}`}>
                  <td className="font-mono">{o.id}</td>
                  <td>{o.customer_id}<div className="text-xs text-slate-500">{o.sku_id} {o.skus.name}</div></td>
                  <td>{o.qty}</td>
                  <td><span className={`badge ${statusColor(o.status)}`}>{ORDER_STATUS[o.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>{selected ? <AllocationPlanPanel key={selected} orderId={selected} onChanged={reload} /> : <div className="card text-slate-500">左の受注を選択してください</div>}</div>
      </div>
    </div>
  );
}
