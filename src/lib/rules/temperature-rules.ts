// Temperature rules (BR-TEMP-01/02, FR-REC-02/05, FR-TEMP-01/02). Thresholds are Yuki's own versioned policy, read from
// the zone_policies table — never hard-coded as a national standard.

export interface ZonePolicy { zone: string; min_c: number | null; max_c: number; policy_version: string }

export function inRange(temp: number, p: ZonePolicy): boolean {
  return (p.min_c === null || temp >= p.min_c) && temp <= p.max_c;
}

export function rangeLabel(p: ZonePolicy): string {
  return p.min_c === null ? `≤${p.max_c}℃` : `${p.min_c}〜${p.max_c}℃`;
}

/** P0 fields that must be present before an inbound line can be confirmed (FR-REC-02). */
export function missingInboundFields(line: Record<string, unknown>): string[] {
  const labels: Record<string, string> = {
    sku_id: "SKU", lot_code: "ロット", mfg_date: "製造日", expiry_date: "期限日", qty: "数量", measured_temp_c: "実測温度",
  };
  return Object.entries(labels).filter(([k]) => line[k] === undefined || line[k] === null || line[k] === "").map(([, v]) => v);
}

export interface Reading { at: string; temp: number }
export interface Excursion { firstAt: string; lastAt: string; peak: number; count: number }

/**
 * Parse a logger CSV ("timestamp,temperature" per line, header optional) and group consecutive out-of-range
 * readings into excursion events. Rejected lines are returned with their line numbers (FR-TEMP-01).
 */
export function parseLoggerCsv(text: string): { readings: Reading[]; rejected: number[] } {
  const readings: Reading[] = [];
  const rejected: number[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || /^timestamp/i.test(line)) return;
    const [at, t] = line.split(",").map((s) => s.trim());
    const temp = Number(t);
    if (!at || Number.isNaN(Date.parse(at)) || t === undefined || Number.isNaN(temp)) rejected.push(i + 1);
    else readings.push({ at: new Date(at).toISOString(), temp });
  });
  return { readings, rejected };
}

export function findExcursions(readings: Reading[], p: ZonePolicy): Excursion[] {
  const out: Excursion[] = [];
  let cur = null as Excursion | null;
  for (const r of [...readings].sort((a, b) => a.at.localeCompare(b.at))) {
    if (!inRange(r.temp, p)) {
      const worse: number = p.min_c !== null && r.temp < p.min_c ? Math.min(cur?.peak ?? r.temp, r.temp) : Math.max(cur?.peak ?? r.temp, r.temp);
      cur = cur !== null ? { ...cur, lastAt: r.at, peak: worse, count: cur.count + 1 } : { firstAt: r.at, lastAt: r.at, peak: r.temp, count: 1 };
    } else if (cur) {
      out.push(cur);
      cur = null;
    }
  }
  if (cur) out.push(cur);
  return out;
}
