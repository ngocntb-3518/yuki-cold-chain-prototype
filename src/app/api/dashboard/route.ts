// Home dashboard counters (SCR-00-02)
import { ok, withUser } from "@/lib/api-helpers";

export async function GET() {
  const auth = await withUser();
  if ("error" in auth) return auth.error;
  const { db } = auth;
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const [alarms, quarantine, openOrders, review, draftRoutes] = await Promise.all([
    count(db.from("temp_alarms").select("id", { count: "exact", head: true }).is("acknowledged_at", null)),
    count(db.from("lots").select("id", { count: "exact", head: true }).eq("status", "QUARANTINE")),
    count(db.from("orders").select("id", { count: "exact", head: true }).eq("status", "OPEN")),
    count(db.from("orders").select("id", { count: "exact", head: true }).eq("status", "BUSINESS_REVIEW")),
    count(db.from("routes").select("id", { count: "exact", head: true }).eq("status", "DRAFT")),
  ]);
  return ok({ alarms, quarantine, openOrders, review, draftRoutes });
}
