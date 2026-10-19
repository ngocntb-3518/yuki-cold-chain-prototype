// Inbound inspection (SCR-02-02, FR-REC-02/04/05, BR-TEMP-02, BR-TRACE-01/02).
// Missing P0 fields block confirmation; out-of-range temperature puts the new lot into quarantine (QC decides later).
import { audit, fail, ok, withUser, zoneOfLocation } from "@/lib/api-helpers";
import { inRange, missingInboundFields, rangeLabel } from "@/lib/rules/temperature-rules";

// R-01: chilled and frozen have a physical -Q area; ambient has none, so an ambient lot is quarantined in place by status (Q15)
const QUARANTINE_LOCATION: Record<string, string> = { CHILLED: "C-Q-01", FROZEN: "F-Q-01" };

export async function POST(req: Request) {
  const auth = await withUser();
  if ("error" in auth) return auth.error;
  const { db, userId } = auth;
  const body = await req.json().catch(() => ({}));

  const missing = missingInboundFields(body);
  if (missing.length) return fail("MISSING_FIELDS", 422, { missing });

  const { data: sku } = await db.from("skus").select("id, zone, trace_lane").eq("id", body.sku_id).single();
  if (!sku) return fail("SKU_NOT_FOUND", 404);
  if (sku.trace_lane === "beef" && !/^\d{10}$/.test(String(body.beef_id ?? "")))
    return fail("BEEF_ID_INVALID", 422, { message: "牛個体識別番号は10桁の数字で入力してください（自動補正しません）" });
  if (sku.trace_lane === "rice" && !String(body.rice_origin ?? "").trim())
    return fail("RICE_ORIGIN_REQUIRED", 422, { message: "米トレーサビリティ：産地・取引情報が必要です" });
  if (String(body.expiry_date) <= String(body.mfg_date)) return fail("EXPIRY_BEFORE_MFG", 422);

  const { data: policy } = await db.from("zone_policies").select("*").eq("zone", sku.zone).single();
  if (!policy) return fail("POLICY_NOT_FOUND", 500);
  const temp = Number(body.measured_temp_c);
  const tempOk = inRange(temp, policy);
  const qty = Number(body.qty);
  if (!Number.isInteger(qty) || qty <= 0) return fail("QTY_INVALID", 422);

  const location = tempOk ? String(body.location || "") : QUARANTINE_LOCATION[sku.zone] ?? String(body.location || "");
  if (!location) return fail("MISSING_FIELDS", 422, { missing: ["格納ロケーション"] });
  // BR-TEMP-02: the storage location's zone must match the SKU zone (no exception)
  if (zoneOfLocation(location) !== sku.zone)
    return fail("ZONE_MISMATCH", 422, { message: `ロケーション ${location} は SKU の温度帯（${sku.zone}）と一致しません` });

  const { data: lot, error } = await db.from("lots").insert({
    lot_code: body.lot_code, sku_id: sku.id, supplier: body.supplier || "（未入力）", mfg_date: body.mfg_date, expiry_date: body.expiry_date,
    qty_received: qty, qty_available: qty, location, status: tempOk ? "AVAILABLE" : "QUARANTINE",
    beef_id: sku.trace_lane === "beef" ? body.beef_id : null, rice_origin: sku.trace_lane === "rice" ? body.rice_origin : null,
  }).select("id, lot_code, status, location").single();
  // unique lot_code makes a retried request fail instead of creating a duplicate lot (idempotent confirmation)
  if (error) return fail(error.code === "23505" ? "LOT_ALREADY_EXISTS" : error.message, error.code === "23505" ? 409 : 500);

  const reason = tempOk ? null : `実測 ${temp}℃ が ${sku.zone} の閾値 ${rangeLabel(policy)} 外`;
  await db.from("inspections").insert({
    lot_id: lot.id, sku_id: sku.id, lot_code: body.lot_code, expiry_date: body.expiry_date, qty, measured_temp_c: temp,
    result: tempOk ? "ACCEPTED" : "QUARANTINED", reason, policy_version: policy.policy_version, inspected_by: userId,
  });
  await audit(db, userId, tempOk ? "INBOUND_ACCEPT" : "INBOUND_QUARANTINE", "lot", lot.id, { temp, policy: policy.policy_version, reason });
  return ok({ lot, result: tempOk ? "ACCEPTED" : "QUARANTINED", reason }, 201);
}
