"use client";
// Route planning check (SCR-07-02 / SCR-07-03): timeline per driver, violations highlighted, publish blocked on violations
import { useState } from "react";
import { sendJson, useApi } from "@/components/use-api";
import { LEG } from "@/components/labels";

type Violation = { code: string; message: string; fromMin?: number; toMin?: number; blocking: boolean };
type Route = {
  id: string; driver_id: string; route_date: string; start_time: string; status: string; rule_version: string | null; extension_approved: boolean;
  drivers: { name: string }; ruleVersion: string;
  check: { restraintMin: number; drivingMin: number; publishable: boolean; violations: Violation[]; timeline: { seq: number; kind: string; minutes: number; label: string | null; fromMin: number; toMin: number }[] };
};
const COLOR: Record<string, string> = { DRIVE: "bg-sky-600", BREAK: "bg-emerald-500", SERVICE: "bg-indigo-400", WAIT: "bg-amber-400" };
const hm = (m: number) => `${Math.floor(m / 60) % 24}:${String(m % 60).padStart(2, "0")}`;
const DAY_START = 4 * 60;
const SPAN = 20 * 60; // 04:00 - 24:00

export default function RoutesPage() {
  const { data, error, reload } = useApi<{ routes: Route[] }>("/api/routes");
  const [msg, setMsg] = useState<string | null>(null);
  async function publish(id: string) {
    const r = await sendJson(`/api/routes/${id}/publish`);
    setMsg(r.ok ? `${id} を公開しました（ルール版 ${r.json.route.rule_version}）` : r.error);
    reload();
  }
  const pct = (m: number) => `${Math.max(0, Math.min(100, ((m - DAY_START) / SPAN) * 100))}%`;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">配車・拘束時間チェック</h1>
      {(error || msg) && <p className="text-sm text-amber-700">{error ?? msg}</p>}
      {data?.routes.map((r) => (
        <div key={r.id} className="card space-y-2">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <b className="text-base">{r.id}</b><span>{r.route_date}</span><span>{r.driver_id} {r.drivers.name}</span>
            <span>拘束 {hm(r.check.restraintMin)}</span><span>運転 {hm(r.check.drivingMin)}</span>
            {r.extension_approved && <span className="badge bg-slate-100">延長条件 承認済み</span>}
            <span className={`badge ${r.status === "PUBLISHED" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100"}`}>{r.status === "PUBLISHED" ? `公開済（${r.rule_version}）` : "下書き"}</span>
            {r.status === "DRAFT" && <button className="btn ml-auto" disabled={!r.check.publishable} onClick={() => publish(r.id)}>{r.check.publishable ? "公開" : "違反のため公開不可"}</button>}
          </div>
          <div className="relative h-8 rounded bg-slate-100">
            {r.check.timeline.map((l) => (
              <div key={l.seq} title={`${LEG[l.kind]} ${hm(l.fromMin)}-${hm(l.toMin)} ${l.label ?? ""}`} className={`absolute top-1 h-6 rounded-sm ${COLOR[l.kind]}`}
                style={{ left: pct(l.fromMin), width: `calc(${pct(l.toMin)} - ${pct(l.fromMin)})` }} />
            ))}
            {r.check.violations.filter((v) => v.fromMin !== undefined).map((v, i) => (
              <div key={i} className="absolute -bottom-1 h-1.5 bg-red-600" style={{ left: pct(v.fromMin!), width: `calc(${pct(v.toMin!)} - ${pct(v.fromMin!)})` }} />
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-slate-400">{[4, 8, 12, 16, 20, 24].map((h) => <span key={h}>{h}:00</span>)}</div>
          {r.check.violations.length > 0 && (
            <ul className="text-sm">
              {r.check.violations.map((v, i) => <li key={i} className={v.blocking ? "text-red-700" : "text-amber-700"}>{v.blocking ? "✖" : "⚠"} {v.message}{v.fromMin !== undefined ? `（${hm(v.fromMin)}〜${hm(v.toMin!)}）` : ""}</li>)}
            </ul>
          )}
        </div>
      ))}
      <p className="text-xs text-slate-500">凡例：運転＝青、休憩＝緑、荷役＝紫、荷待ち＝黄、違反区間＝赤線。月284h・年3,300h・時間外年960h は月次実績が必要なためプロトタイプ対象外。基準値は設計凍結前に公式資料で再確認（OPS-LAW-01）。</p>
    </div>
  );
}
