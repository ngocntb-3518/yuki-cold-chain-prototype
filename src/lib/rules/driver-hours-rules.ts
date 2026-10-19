// Driver working-time check for a planned route (RFP D5 FR-SCH-02/03, 改善基準告示 values as summarised in the RFP p.34).
// The values must be re-verified against the official source before design freeze (OPS-LAW-01); they are versioned here.
// Prototype scope: one-day checks (restraint, continuous driving, rest since previous route, 2-day average driving).
// Monthly/annual limits (284h/month, 3,300h/year, overtime 960h/year) need payroll-grade history and are mocked out.

export const DRIVER_RULE_VERSION = "KAIZEN-KIJUN-2024.04 (prototype)";
export const LIMITS = {
  restraintNormalMin: 13 * 60, // 1日の拘束 13h
  restraintMaxMin: 15 * 60, // extension up to 15h only when the extension conditions are met (details pending Q21)
  continuousDrivingMin: 4 * 60, // 連続運転 4h
  breakResetMin: 30, // a break of at least 30 minutes resets continuous driving (prototype simplification)
  restTargetMin: 11 * 60, // 休息期間 11h target
  restMinimumMin: 9 * 60, // 9h minimum
  twoDayAvgDrivingMin: 9 * 60, // 2日平均 9h
};

export type LegKind = "DRIVE" | "BREAK" | "SERVICE" | "WAIT";
export interface Leg { seq: number; kind: LegKind; minutes: number; label?: string | null }
export interface Violation { code: string; message: string; fromMin?: number; toMin?: number; blocking: boolean }

export interface RouteCheckInput {
  startMinOfDay: number; // minutes after 00:00
  legs: Leg[];
  extensionApproved: boolean;
  previousRouteEndAbsMin: number | null; // previous route end, in minutes relative to this route's day 00:00 (negative = day before)
  previousDayDrivingMin: number | null;
}

export interface RouteCheckResult {
  restraintMin: number;
  drivingMin: number;
  violations: Violation[];
  publishable: boolean;
  timeline: (Leg & { fromMin: number; toMin: number })[];
}

export function checkRoute(input: RouteCheckInput): RouteCheckResult {
  const legs = [...input.legs].sort((a, b) => a.seq - b.seq);
  const violations: Violation[] = [];
  const timeline: RouteCheckResult["timeline"] = [];
  let t = input.startMinOfDay;
  let streak = 0;
  let streakStart = t;
  let driving = 0;

  for (const leg of legs) {
    const fromMin = t;
    t += leg.minutes;
    timeline.push({ ...leg, fromMin, toMin: t });
    if (leg.kind === "DRIVE") {
      if (streak === 0) streakStart = fromMin;
      streak += leg.minutes;
      driving += leg.minutes;
      if (streak > LIMITS.continuousDrivingMin)
        violations.push({ code: "CONTINUOUS_DRIVING", message: `連続運転 ${fmt(streak)}（上限 4:00）`, fromMin: streakStart, toMin: t, blocking: true });
    } else if (leg.kind === "BREAK" && leg.minutes >= LIMITS.breakResetMin) {
      streak = 0;
    }
  }
  // keep only the longest streak per drive block (avoid one message per leg)
  const dedup = violations.filter((v, i) => !(v.code === "CONTINUOUS_DRIVING" && violations.slice(i + 1).some((w) => w.code === v.code && w.fromMin === v.fromMin)));

  const restraint = t - input.startMinOfDay;
  if (restraint > LIMITS.restraintMaxMin)
    dedup.push({ code: "RESTRAINT_MAX", message: `1日の拘束 ${fmt(restraint)}（最大 15:00 を超過）`, fromMin: input.startMinOfDay + LIMITS.restraintMaxMin, toMin: t, blocking: true });
  else if (restraint > LIMITS.restraintNormalMin && !input.extensionApproved)
    dedup.push({ code: "RESTRAINT_EXTENSION_REQUIRED", message: `1日の拘束 ${fmt(restraint)}（13:00 超は延長条件の充足が必要）`, fromMin: input.startMinOfDay + LIMITS.restraintNormalMin, toMin: t, blocking: true });

  if (input.previousRouteEndAbsMin !== null) {
    const rest = input.startMinOfDay - input.previousRouteEndAbsMin;
    if (rest < LIMITS.restMinimumMin) dedup.push({ code: "REST_MIN", message: `休息期間 ${fmt(rest)}（最低 9:00 未満）`, blocking: true });
    else if (rest < LIMITS.restTargetMin) dedup.push({ code: "REST_TARGET", message: `休息期間 ${fmt(rest)}（目標 11:00 未満、9:00 以上）`, blocking: false });
  }
  if (input.previousDayDrivingMin !== null && (input.previousDayDrivingMin + driving) / 2 > LIMITS.twoDayAvgDrivingMin)
    dedup.push({ code: "TWO_DAY_AVG", message: `2日平均運転 ${fmt((input.previousDayDrivingMin + driving) / 2)}（上限 9:00）`, blocking: true });

  return { restraintMin: restraint, drivingMin: driving, violations: dedup, publishable: !dedup.some((v) => v.blocking), timeline };
}

export function fmt(min: number): string {
  const m = Math.round(min);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}
