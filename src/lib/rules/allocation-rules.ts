// Allocation rules (RFP D3/D4: BR-EXP-01/02, BR-FEFO-01, BR-DATE-01, BR-DELWIN-01, exclusion order).
// Pure functions: no database access, so every rule is unit-tested with the RFP fixtures.

export type ExpiryType = "BEST_BEFORE" | "USE_BY"; // 賞味期限 / 消費期限
export type WindowRule = "ONE_THIRD" | "ONE_HALF" | "LABEL_DATE_ONLY" | null;
export type Zone = "AMBIENT" | "CHILLED" | "FROZEN";

export interface LotInput {
  id: string;
  lotCode: string;
  mfgDate: string; // YYYY-MM-DD
  expiryDate: string;
  receivedAt: string; // ISO timestamp
  qtyAvailable: number;
  status: "AVAILABLE" | "QUARANTINE" | "SCRAPPED";
  locationZone: Zone;
}

export interface AllocationContext {
  skuZone: Zone;
  expiryType: ExpiryType;
  windowRule: WindowRule;
  requestedDate: string; // delivery date of the order
  lastReceivedExpiry: string | null; // latest accepted delivery for the same customer x SKU
}

export type ExclusionCode = "USE_BY_REACHED" | "ZONE_MISMATCH" | "QUARANTINE" | "WINDOW_EXCEEDED" | "DATE_REVERSAL" | "NO_STOCK";

export interface LotEvaluation {
  lot: LotInput;
  excluded: ExclusionCode | null;
  reason: string;
  warnings: string[];
  deliveryDeadline: string | null; // computed contract deadline (null for LABEL_DATE_ONLY)
}

const DAY = 86_400_000;
const toDay = (d: string) => Math.floor(Date.parse(`${d.slice(0, 10)}T00:00:00Z`) / DAY);
const fromDay = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);

/** Contract delivery deadline. Assumption (question Q12): base = manufacture date, rounded down to whole days. */
export function deliveryDeadline(rule: WindowRule, mfgDate: string, expiryDate: string): string | null {
  if (rule !== "ONE_THIRD" && rule !== "ONE_HALF") return null;
  const life = toDay(expiryDate) - toDay(mfgDate);
  const share = rule === "ONE_THIRD" ? Math.floor(life / 3) : Math.floor(life / 2);
  return fromDay(toDay(mfgDate) + share);
}

/** Evaluate one lot in the fixed exclusion order; the first failing rule is reported. */
export function evaluateLot(lot: LotInput, ctx: AllocationContext): LotEvaluation {
  const warnings: string[] = [];
  const deadline = deliveryDeadline(ctx.windowRule, lot.mfgDate, lot.expiryDate);
  const result = (excluded: ExclusionCode | null, reason: string): LotEvaluation => ({ lot, excluded, reason, warnings, deliveryDeadline: deadline });
  const delivery = toDay(ctx.requestedDate);
  const expiry = toDay(lot.expiryDate);

  // 1. 消費期限: reached on or before the delivery date -> hard stop (assumption Q28: "到来" = expiry date <= delivery date)
  if (ctx.expiryType === "USE_BY" && expiry <= delivery) return result("USE_BY_REACHED", `消費期限（${lot.expiryDate}）が納品日までに到来`);
  // 賞味期限 only warns; the contract window below decides
  if (ctx.expiryType === "BEST_BEFORE" && expiry <= delivery) warnings.push(`賞味期限（${lot.expiryDate}）が納品日までに到来`);
  // 2. temperature zone of the stored location must match the SKU zone
  if (lot.locationZone !== ctx.skuZone) return result("ZONE_MISMATCH", `保管温度帯（${lot.locationZone}）が SKU の温度帯（${ctx.skuZone}）と不一致`);
  // 3. quarantined lots are never allocatable, even with the earliest expiry
  if (lot.status !== "AVAILABLE") return result("QUARANTINE", "隔離中（品質管理の判定待ち）");
  // 4. contract delivery window (commercial custom per agreement, not law)
  if (deadline !== null && delivery > toDay(deadline)) return result("WINDOW_EXCEEDED", `契約上の納品期限（${deadline}）を超過`);
  if (ctx.windowRule === "LABEL_DATE_ONLY" && expiry < delivery) return result("WINDOW_EXCEEDED", `ラベル期限（${lot.expiryDate}）が納品日より前`);
  // 5. 日付逆転禁止: compare with the same customer x SKU's last received expiry, never with today.
  //    Assumption (Q13): an equal expiry date is allowed.
  if (ctx.lastReceivedExpiry && expiry < toDay(ctx.lastReceivedExpiry))
    return result("DATE_REVERSAL", `日付逆転：前回受領ロットの期限（${ctx.lastReceivedExpiry}）より古い`);
  if (lot.qtyAvailable <= 0) return result("NO_STOCK", "引当可能数量なし");
  return result(null, "引当可能");
}

/** FEFO, and FIFO by receipt time when expiry dates are equal (BR-FEFO-01). */
export function fefoOrder(a: LotInput, b: LotInput): number {
  return a.expiryDate.localeCompare(b.expiryDate) || a.receivedAt.localeCompare(b.receivedAt);
}

export interface AllocationPlan {
  status: "OK" | "BUSINESS_REVIEW" | "SHORT";
  evaluations: LotEvaluation[];
  picks: { lotId: string; lotCode: string; qty: number }[];
  shortBy: number;
}

/** Evaluate every candidate lot and pick quantities in FEFO/FIFO order. */
export function planAllocation(lots: LotInput[], ctx: AllocationContext, qty: number, hasAgreement: boolean): AllocationPlan {
  const evaluations = [...lots].sort(fefoOrder).map((lot) => evaluateLot(lot, ctx));
  // Agreement exists but its delivery window rule is not agreed yet: never default it (R-04 AGR-008 / AGR-014)
  if (hasAgreement && ctx.windowRule === null) return { status: "BUSINESS_REVIEW", evaluations, picks: [], shortBy: qty };
  const picks: AllocationPlan["picks"] = [];
  let remaining = qty;
  for (const e of evaluations) {
    if (e.excluded || remaining === 0) continue;
    const take = Math.min(remaining, e.lot.qtyAvailable);
    picks.push({ lotId: e.lot.id, lotCode: e.lot.lotCode, qty: take });
    remaining -= take;
  }
  return { status: remaining === 0 ? "OK" : "SHORT", evaluations, picks, shortBy: remaining };
}
