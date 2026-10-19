// Loads everything the allocation rules need for one order and runs them. Shared by the "plan" and "allocate" APIs so
// the lots shown to the planner are evaluated with exactly the same rules that the allocation itself enforces.
import type { Db } from "@/lib/api-helpers";
import { zoneOfLocation } from "@/lib/api-helpers";
import { planAllocation, type AllocationContext, type LotInput, type WindowRule } from "@/lib/rules/allocation-rules";

export async function buildOrderPlan(db: Db, orderId: string) {
  const { data: order, error } = await db
    .from("orders")
    .select("id, customer_id, sku_id, qty, requested_date, status, customers(name), skus(name, zone, expiry_type)")
    .eq("id", orderId)
    .single();
  if (error || !order) return { ok: false as const, error: "ORDER_NOT_FOUND" };

  const [{ data: agreement }, { data: lots }, { data: last }] = await Promise.all([
    db.from("agreements").select("id, window_rule, delivery_term").eq("customer_id", order.customer_id).eq("sku_id", order.sku_id).maybeSingle(),
    db.from("lots").select("id, lot_code, mfg_date, expiry_date, received_at, qty_available, status, location").eq("sku_id", order.sku_id).neq("status", "SCRAPPED"),
    // latest accepted delivery for THIS customer x SKU (never another customer's, never "today")
    db.from("delivery_history").select("expiry_date, received_at").eq("customer_id", order.customer_id).eq("sku_id", order.sku_id)
      .order("received_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const sku = order.skus as unknown as { name: string; zone: AllocationContext["skuZone"]; expiry_type: AllocationContext["expiryType"] };
  const ctx: AllocationContext = {
    skuZone: sku.zone,
    expiryType: sku.expiry_type,
    windowRule: (agreement?.window_rule ?? null) as WindowRule,
    requestedDate: order.requested_date,
    lastReceivedExpiry: last?.expiry_date ?? null,
  };
  const inputs: LotInput[] = (lots ?? []).map((l) => ({
    id: l.id, lotCode: l.lot_code, mfgDate: l.mfg_date, expiryDate: l.expiry_date, receivedAt: l.received_at,
    qtyAvailable: l.qty_available, status: l.status, locationZone: zoneOfLocation(l.location),
  }));
  const plan = planAllocation(inputs, ctx, order.qty, Boolean(agreement));
  return { ok: true as const, order, agreement, sku, ctx, plan, lastReceived: last ?? null };
}
