"use client";
// Temperature alarm queue (SCR-08-02) with the 15-minute review countdown, and logger CSV import (SCR-08-01)
import { useEffect, useState } from "react";
import { sendJson, useApi } from "@/components/use-api";
import { ZONE, fmtDateTime } from "@/components/labels";

type Alarm = { id: string; logger: string; zone: string; first_at: string; last_at: string; peak_c: number; policy_version: string; source_file: string | null; created_at: string; acknowledged_at: string | null; deadline: string; overdue: boolean; reviewedLate: boolean | null };
const SAMPLE = "timestamp,temperature\n2026-10-19T00:00:00+09:00,3.8\n2026-10-19T00:15:00+09:00,5.6\n2026-10-19T00:30:00+09:00,6.4\n2026-10-19T00:45:00+09:00,4.1";

export default function AlarmsPage() {
  const { data, error, reload } = useApi<{ alarms: Alarm[] }>("/api/alarms");
  const [now, setNow] = useState(Date.now());
  const [logger, setLogger] = useState("DL-C01");
  const [csv, setCsv] = useState(SAMPLE);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  async function ack(id: string) {
    const r = await sendJson(`/api/alarms/${id}/ack`);
    setMsg(r.ok ? "初回レビューを記録しました" : r.error);
    reload();
  }
  async function importCsv() {
    const r = await sendJson("/api/alarms/import", { logger, csv, fileName: `logger-${logger}-manual.csv` });
    setMsg(r.ok ? `取込 ${r.json.readings} 件、不正行 ${r.json.rejectedLines.join(", ") || "なし"}、警報 ${r.json.alarmsCreated} 件生成` : r.error);
    reload();
  }
  const remain = (deadline: string) => {
    const s = Math.round((Date.parse(deadline) - now) / 1000);
    return s <= 0 ? "期限超過" : `残り ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">温度警報（初回レビュー期限 15 分）</h1>
      {(error || msg) && <p className="text-sm text-amber-700">{error ?? msg}</p>}
      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>ロガー</th><th>温度帯</th><th>逸脱期間</th><th>ピーク</th><th>警報生成</th><th>レビュー期限</th><th>レビュー</th></tr></thead>
          <tbody>
            {data?.alarms.map((a) => (
              <tr key={a.id} className={!a.acknowledged_at && Date.parse(a.deadline) < now ? "bg-red-50" : ""}>
                <td>{a.logger}<div className="text-xs text-slate-500">{a.source_file}</div></td>
                <td>{ZONE[a.zone]}</td>
                <td className="text-xs">{fmtDateTime(a.first_at)} 〜 {fmtDateTime(a.last_at)}</td>
                <td className="font-semibold">{a.peak_c}℃</td>
                <td className="text-xs">{fmtDateTime(a.created_at)}</td>
                <td className={!a.acknowledged_at && Date.parse(a.deadline) < now ? "font-bold text-red-700" : ""}>{a.acknowledged_at ? "—" : remain(a.deadline)}</td>
                <td>{a.acknowledged_at
                  ? <span className="text-xs">{fmtDateTime(a.acknowledged_at)} {a.reviewedLate ? "（期限超過）" : "（期限内）"}</span>
                  : <button className="btn" onClick={() => ack(a.id)}>レビュー記録</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-slate-500">期限の起点は CSV 取込で警報が生成された時刻（前提・質問 Q02）。夜間運用・逸脱ケース管理・ロットの自動保留はプロトタイプ対象外。</p>
      </div>
      <div className="card space-y-2">
        <h2 className="font-semibold">ロガー CSV 取込</h2>
        <select className="input max-w-40" value={logger} onChange={(e) => setLogger(e.target.value)}>
          <option value="DL-A01">DL-A01（常温）</option><option value="DL-C01">DL-C01（冷蔵）</option><option value="DL-F01">DL-F01（冷凍）</option>
        </select>
        <textarea className="input h-32 font-mono" value={csv} onChange={(e) => setCsv(e.target.value)} />
        <button className="btn" onClick={importCsv}>取込・判定</button>
      </div>
    </div>
  );
}
