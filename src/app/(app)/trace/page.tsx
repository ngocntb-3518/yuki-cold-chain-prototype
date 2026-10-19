"use client";
// Traceability search (SCR-09-01): lot code, 10-digit beef ID or rice origin -> lot -> orders -> customers
import { useState } from "react";
import { LOT_STATUS, ORDER_STATUS, fmtDateTime, statusColor } from "@/components/labels";

type TraceLot = {
  id: string; lot_code: string; sku_id: string; supplier: string; mfg_date: string; expiry_date: string; status: string; location: string;
  beef_id: string | null; rice_origin: string | null; qty_received: number; skus: { name: string; trace_lane: string };
  allocations: { qty: number; order_id: string; orders: { customer_id: string; status: string; customers: { name: string } } }[];
  delivery_history: { customer_id: string; received_at: string; customers: { name: string } }[];
};

export default function TracePage() {
  const [q, setQ] = useState("");
  const [lots, setLots] = useState<TraceLot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function search(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/trace?q=${encodeURIComponent(q)}`);
    const body = await res.json();
    if (!res.ok) { setError(body.error); setLots(null); return; }
    setError(null);
    setLots(body.lots);
  }
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">トレース検索</h1>
      <form onSubmit={search} className="card flex flex-wrap gap-3">
        <input className="input max-w-md" placeholder="ロット番号 / 牛個体識別番号（10桁）/ 米の産地・取引ID" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn">検索</button>
        <span className="self-center text-xs text-slate-500">法定トレーサビリティは米（AMB-001）と牛（CHI-001）のみ。その他は社内ロット追跡。</span>
      </form>
      {error && <p className="text-red-600">{error}</p>}
      {lots?.length === 0 && <p className="text-slate-500">該当なし</p>}
      {lots?.map((l) => (
        <div key={l.id} className="card space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <b className="font-mono text-base">{l.lot_code}</b><span>{l.sku_id} {l.skus.name}</span>
            <span className={`badge ${statusColor(l.status)}`}>{LOT_STATUS[l.status]}</span>
            <span>期限 {l.expiry_date}</span><span>仕入先 {l.supplier}</span><span>{l.location}</span>
          </div>
          <div className="text-xs">{l.beef_id ? `牛個体識別番号 ${l.beef_id}` : l.rice_origin ? `米トレーサビリティ ${l.rice_origin}` : "社内ロット"}</div>
          <div className="grid gap-3 md:grid-cols-2">
            <div><div className="font-semibold">引当（下流）</div>
              {l.allocations.length ? l.allocations.map((a) => (
                <div key={a.order_id}>{a.order_id} → {a.orders.customer_id} {a.orders.customers.name}・{a.qty}（<span className={`badge ${statusColor(a.orders.status)}`}>{ORDER_STATUS[a.orders.status]}</span>）</div>
              )) : <div className="text-slate-500">なし</div>}
            </div>
            <div><div className="font-semibold">受領済み納品</div>
              {l.delivery_history.length ? l.delivery_history.map((d, i) => <div key={i}>{d.customer_id} {d.customers.name}・{fmtDateTime(d.received_at)}</div>) : <div className="text-slate-500">なし</div>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
