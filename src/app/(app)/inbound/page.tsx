"use client";
// Inbound inspection (SCR-02-02): P0 fields required; temperature checked against Yuki's versioned zone policy
import { useMemo, useState } from "react";
import { sendJson, useApi } from "@/components/use-api";
import { EXPIRY, ZONE } from "@/components/labels";

type Sku = { id: string; name: string; zone: string; expiry_type: string; trace_lane: string };
type Policy = { zone: string; min_c: number | null; max_c: number; policy_version: string };
const LOCATIONS: Record<string, string[]> = {
  AMBIENT: ["A-01-01", "A-02-01", "A-03-01"], CHILLED: ["C-01-01", "C-02-01", "C-03-01"], FROZEN: ["F-01-01", "F-02-01", "F-03-01", "F-04-01"],
};
const EMPTY = { sku_id: "", supplier: "", lot_code: "", mfg_date: "", expiry_date: "", qty: "", measured_temp_c: "", location: "", beef_id: "", rice_origin: "" };

export default function InboundPage() {
  const { data } = useApi<{ skus: Sku[]; policies: Policy[] }>("/api/masters");
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const sku = useMemo(() => data?.skus.find((s) => s.id === form.sku_id), [data, form.sku_id]);
  const policy = data?.policies.find((p) => p.zone === sku?.zone);
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const payload = { ...form, qty: form.qty === "" ? "" : Number(form.qty), measured_temp_c: form.measured_temp_c === "" ? "" : Number(form.measured_temp_c) };
    const r = await sendJson("/api/inbound", payload);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error ?? "エラー" });
    setMsg(r.json.result === "ACCEPTED"
      ? { ok: true, text: `受入確定：ロット ${r.json.lot.lot_code} を ${r.json.lot.location} に登録しました` }
      : { ok: false, text: `隔離：${r.json.reason}。ロット ${r.json.lot.lot_code} は ${r.json.lot.location} で品質管理の判定待ちです` });
    setForm({ ...EMPTY, sku_id: form.sku_id, supplier: form.supplier });
  }

  const field = (k: keyof typeof EMPTY, label: string, type = "text", extra = {}) => (
    <label className="text-sm">{label}<input className="input mt-1" type={type} value={form[k]} onChange={set(k)} {...extra} /></label>
  );
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">入荷検品</h1>
      <form onSubmit={submit} className="card grid gap-3 md:grid-cols-3">
        <label className="text-sm">SKU
          <select className="input mt-1" value={form.sku_id} onChange={set("sku_id")}>
            <option value="">選択してください</option>
            {data?.skus.map((s) => <option key={s.id} value={s.id}>{s.id} {s.name}</option>)}
          </select>
        </label>
        {field("supplier", "仕入先")}
        {field("lot_code", "ロット番号 *")}
        {field("mfg_date", "製造日 *", "date")}
        {field("expiry_date", `期限日 *（${sku ? EXPIRY[sku.expiry_type] : "—"}）`, "date")}
        {field("qty", "数量 *", "number", { min: 1 })}
        {field("measured_temp_c", `実測温度 ℃ *（閾値 ${policy ? (policy.min_c === null ? `≤${policy.max_c}` : `${policy.min_c}〜${policy.max_c}`) : "—"}）`, "number", { step: "0.1" })}
        <label className="text-sm">格納ロケーション（{sku ? ZONE[sku.zone] : "—"}）
          <select className="input mt-1" value={form.location} onChange={set("location")}>
            <option value="">選択してください</option>
            {Object.values(LOCATIONS).flat().map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        {sku?.trace_lane === "beef" && field("beef_id", "牛個体識別番号（10桁）*")}
        {sku?.trace_lane === "rice" && field("rice_origin", "米：産地・取引情報 *")}
        <div className="flex items-end gap-3 md:col-span-3">
          <button className="btn" disabled={busy || !form.sku_id}>検品確定</button>
          {policy && <span className="text-xs text-slate-500">温度ポリシー {policy.policy_version}（貴社独自の基準）</span>}
        </div>
      </form>
      {msg && <div className={`card ${msg.ok ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50"}`}>{msg.text}</div>}
    </div>
  );
}
