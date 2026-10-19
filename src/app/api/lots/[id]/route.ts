// QC disposition of a quarantined lot (SCR-03-06, FR-INV-05, FR-TEMP-04): RELEASE or SCRAP, rationale mandatory.
// The system never releases a lot automatically; only valid transitions are accepted.
import { audit, fail, ok, withUser } from "@/lib/api-helpers";

const RELEASE_LOCATION: Record<string, string> = { "C-Q-01": "C-01-01", "F-Q-01": "F-01-01" };

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withUser();
  if ("error" in auth) return auth.error;
  const { db, userId } = auth;
  const { id } = await params;
  const { action, rationale } = await req.json().catch(() => ({}));
  if (action !== "RELEASE" && action !== "SCRAP") return fail("INVALID_ACTION", 422);
  if (!String(rationale ?? "").trim()) return fail("RATIONALE_REQUIRED", 422, { message: "判定理由を入力してください" });

  const { data: lot } = await db.from("lots").select("id, status, location, qty_available").eq("id", id).single();
  if (!lot) return fail("LOT_NOT_FOUND", 404);
  if (lot.status !== "QUARANTINE") return fail("INVALID_TRANSITION", 409, { message: `現在の状態（${lot.status}）からは変更できません` });

  const patch = action === "RELEASE"
    ? { status: "AVAILABLE", location: RELEASE_LOCATION[lot.location] ?? lot.location }
    : { status: "SCRAPPED", qty_available: 0 };
  // conditional update: only succeeds if the lot is still quarantined (protects against double decisions)
  const { data, error } = await db.from("lots").update(patch).eq("id", id).eq("status", "QUARANTINE").select("id, status, location").single();
  if (error || !data) return fail("CONFLICT", 409);
  await audit(db, userId, `QC_${action}`, "lot", id, { rationale, from: lot.location, to: data.location });
  return ok({ lot: data });
}
