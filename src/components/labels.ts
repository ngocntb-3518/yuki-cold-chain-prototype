// Japanese display labels for codes stored in the database (UI language: Japanese, NFR-LOC-01)
export const ZONE: Record<string, string> = { AMBIENT: "常温", CHILLED: "冷蔵", FROZEN: "冷凍" };
export const EXPIRY: Record<string, string> = { BEST_BEFORE: "賞味期限", USE_BY: "消費期限" };
export const LOT_STATUS: Record<string, string> = { AVAILABLE: "可用", QUARANTINE: "隔離中", SCRAPPED: "廃棄" };
export const ORDER_STATUS: Record<string, string> = { OPEN: "未引当", ALLOCATED: "引当済", SHIPPED: "納品済", BUSINESS_REVIEW: "業務レビュー保留" };
export const WINDOW: Record<string, string> = { ONE_THIRD: "1/3ルール", ONE_HALF: "1/2ルール", LABEL_DATE_ONLY: "ラベル期限のみ" };
export const TERM: Record<string, string> = { ON_TRUCK: "車上渡し", AT_DOOR: "軒先渡し" };
export const EXCLUSION: Record<string, string> = {
  USE_BY_REACHED: "①消費期限到来", ZONE_MISMATCH: "②温度帯不一致", QUARANTINE: "③隔離中",
  WINDOW_EXCEEDED: "④契約納品期限", DATE_REVERSAL: "⑤日付逆転", NO_STOCK: "在庫なし",
};
export const LEG: Record<string, string> = { DRIVE: "運転", BREAK: "休憩", SERVICE: "荷役", WAIT: "荷待ち" };

export const fmtDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

export const statusColor = (s: string) =>
  ({ AVAILABLE: "bg-emerald-100 text-emerald-800", QUARANTINE: "bg-amber-100 text-amber-800", SCRAPPED: "bg-slate-200 text-slate-600",
     OPEN: "bg-sky-100 text-sky-800", ALLOCATED: "bg-indigo-100 text-indigo-800", SHIPPED: "bg-emerald-100 text-emerald-800",
     BUSINESS_REVIEW: "bg-amber-100 text-amber-800" } as Record<string, string>)[s] ?? "bg-slate-100";
