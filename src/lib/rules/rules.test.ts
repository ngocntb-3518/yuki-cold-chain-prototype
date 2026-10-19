// Rule tests built from the RFP's mandatory test cases (R-06) and fixtures (R-02, R-04).
import { describe, expect, it } from "vitest";
import { deliveryDeadline, evaluateLot, planAllocation, type AllocationContext, type LotInput } from "./allocation-rules";
import { checkRoute } from "./driver-hours-rules";
import { findExcursions, missingInboundFields, parseLoggerCsv } from "./temperature-rules";

const lot = (o: Partial<LotInput>): LotInput => ({
  id: o.lotCode ?? "x", lotCode: "x", mfgDate: "2026-09-01", expiryDate: "2026-10-01", receivedAt: "2026-09-02T00:00:00Z",
  qtyAvailable: 10, status: "AVAILABLE", locationZone: "CHILLED", ...o,
});
const yogurt: AllocationContext = { skuZone: "CHILLED", expiryType: "BEST_BEFORE", windowRule: "ONE_HALF", requestedDate: "2026-09-19", lastReceivedExpiry: null };

describe("日付逆転禁止 (BR-DATE-01, R-06 date reversal)", () => {
  // RFP p.26: CUS-003 / CHI-002 last received 2026-09-20 -> a 2026-09-18 lot must be blocked
  const old = lot({ lotCode: "L-0918", mfgDate: "2026-09-01", expiryDate: "2026-09-18" });
  const withHistory = { ...yogurt, windowRule: "LABEL_DATE_ONLY" as const, requestedDate: "2026-09-10", lastReceivedExpiry: "2026-09-20" };
  it("blocks a lot older than the same customer's last received expiry", () => {
    expect(evaluateLot(old, withHistory).excluded).toBe("DATE_REVERSAL");
  });
  it("does not use another customer's history (no history -> allowed)", () => {
    expect(evaluateLot(old, { ...withHistory, lastReceivedExpiry: null }).excluded).toBeNull();
  });
  it("compares with history, not with today: a lot far in the future but older than history is still blocked", () => {
    expect(evaluateLot(lot({ mfgDate: "2026-09-01", expiryDate: "2026-12-01" }), { ...withHistory, lastReceivedExpiry: "2026-12-05" }).excluded).toBe("DATE_REVERSAL");
  });
  it("allows an equal expiry date (assumption Q13)", () => {
    expect(evaluateLot(lot({ mfgDate: "2026-09-01", expiryDate: "2026-09-20" }), withHistory).excluded).toBeNull();
  });
});

describe("賞味期限 vs 消費期限 (BR-EXP-01/02)", () => {
  it("消費期限 reached on the delivery date is a hard stop", () => {
    const beef = { ...yogurt, expiryType: "USE_BY" as const, requestedDate: "2026-10-01" };
    expect(evaluateLot(lot({}), beef).excluded).toBe("USE_BY_REACHED");
  });
  it("賞味期限 reached only warns (CHI-002 is chilled but BEST_BEFORE); the contract window decides", () => {
    const e = evaluateLot(lot({}), { ...yogurt, windowRule: "LABEL_DATE_ONLY", requestedDate: "2026-10-01" });
    expect(e.excluded).toBeNull();
    expect(e.warnings.length).toBe(1);
  });
});

describe("contract delivery window (BR-DELWIN-01, R-04)", () => {
  it("1/3 and 1/2 deadlines from manufacture date", () => {
    expect(deliveryDeadline("ONE_THIRD", "2026-01-01", "2026-01-31")).toBe("2026-01-11");
    expect(deliveryDeadline("ONE_HALF", "2026-01-01", "2026-01-31")).toBe("2026-01-16");
    expect(deliveryDeadline("LABEL_DATE_ONLY", "2026-01-01", "2026-01-31")).toBeNull();
  });
  it("excludes a lot past its 1/2 deadline", () => {
    expect(evaluateLot(lot({ mfgDate: "2026-09-01", expiryDate: "2026-09-21" }), { ...yogurt, requestedDate: "2026-09-12" }).excluded).toBe("WINDOW_EXCEEDED");
  });
  it("an agreement without a rule (AGR-008 / AGR-014) goes to business review, never a default rule", () => {
    const plan = planAllocation([lot({})], { ...yogurt, windowRule: null }, 5, true);
    expect(plan.status).toBe("BUSINESS_REVIEW");
    expect(plan.picks).toHaveLength(0);
  });
});

describe("exclusion order and FEFO (R-06 FEFO 複数有効ロット)", () => {
  it("a quarantined lot is excluded even with the earliest expiry", () => {
    const ctx = { ...yogurt, windowRule: "LABEL_DATE_ONLY" as const };
    const plan = planAllocation([lot({ lotCode: "Q", expiryDate: "2026-09-25", status: "QUARANTINE" }), lot({ lotCode: "OK" })], ctx, 5, true);
    expect(plan.picks.map((p) => p.lotCode)).toEqual(["OK"]);
  });
  it("zone mismatch is reported before quarantine", () => {
    expect(evaluateLot(lot({ status: "QUARANTINE", locationZone: "AMBIENT" }), yogurt).excluded).toBe("ZONE_MISMATCH");
  });
  it("same expiry -> earlier receipt first; quantities split across lots", () => {
    const a = lot({ lotCode: "B", receivedAt: "2026-09-05T00:00:00Z", qtyAvailable: 4 });
    const b = lot({ lotCode: "A", receivedAt: "2026-09-03T00:00:00Z", qtyAvailable: 4 });
    const plan = planAllocation([a, b], { ...yogurt, windowRule: "LABEL_DATE_ONLY" }, 6, true);
    expect(plan.picks).toEqual([{ lotId: "A", lotCode: "A", qty: 4 }, { lotId: "B", lotCode: "B", qty: 2 }]);
  });
});

describe("driver hours (FR-SCH-02, R-06 route infeasible)", () => {
  const base = { startMinOfDay: 6 * 60, extensionApproved: false, previousRouteEndAbsMin: null, previousDayDrivingMin: null };
  it("4h20 continuous driving blocks publishing", () => {
    const r = checkRoute({ ...base, legs: [{ seq: 1, kind: "DRIVE", minutes: 260 }] });
    expect(r.publishable).toBe(false);
    expect(r.violations.map((v) => v.code)).toContain("CONTINUOUS_DRIVING");
  });
  it("13h-15h restraint needs an approved extension; above 15h is always blocked", () => {
    const legs = [{ seq: 1, kind: "DRIVE" as const, minutes: 200 }, { seq: 2, kind: "BREAK" as const, minutes: 600 }];
    expect(checkRoute({ ...base, legs }).publishable).toBe(false);
    expect(checkRoute({ ...base, legs, extensionApproved: true }).publishable).toBe(true);
    expect(checkRoute({ ...base, legs: [...legs, { seq: 3, kind: "WAIT", minutes: 120 }], extensionApproved: true }).publishable).toBe(false);
  });
  it("rest below 9h since the previous route blocks; a 30-minute break resets continuous driving", () => {
    const legs = [{ seq: 1, kind: "DRIVE" as const, minutes: 200 }, { seq: 2, kind: "BREAK" as const, minutes: 30 }, { seq: 3, kind: "DRIVE" as const, minutes: 200 }];
    expect(checkRoute({ ...base, legs }).publishable).toBe(true);
    expect(checkRoute({ ...base, legs, previousRouteEndAbsMin: -60 }).violations.map((v) => v.code)).toContain("REST_MIN");
  });
});

describe("inbound and logger (FR-REC-02, FR-TEMP-01/02)", () => {
  it("lists every missing P0 field", () => {
    expect(missingInboundFields({ sku_id: "CHI-002", lot_code: "L1", qty: 5 })).toEqual(["製造日", "期限日", "実測温度"]);
  });
  it("rejects malformed lines with their line number and groups excursions", () => {
    const { readings, rejected } = parseLoggerCsv("timestamp,temperature\n2026-10-01T00:00:00Z,4.0\nbad,line\n2026-10-01T00:15:00Z,6.5\n2026-10-01T00:30:00Z,7.1\n2026-10-01T00:45:00Z,3.0");
    expect(rejected).toEqual([3]);
    const ex = findExcursions(readings, { zone: "CHILLED", min_c: 0, max_c: 5, policy_version: "v" });
    expect(ex).toHaveLength(1);
    expect(ex[0]).toMatchObject({ peak: 7.1, count: 2 });
  });
});
