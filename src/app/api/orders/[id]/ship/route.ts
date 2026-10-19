// Delivery confirmation (MOCK of POD, FR-OUT-06): marks the allocated order as delivered and accepted by the customer and
// writes the accepted delivery history that later 日付逆転禁止 checks compare against (DR-HIST-01, append-only).
// Real system: driver POD on a managed device, offline queue, evidence per delivery term — out of prototype scope.
import { audit, fail, ok, withUser } from "@/lib/api-helpers";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withUser();
  if ("error" in auth) return auth.error;
  const { db, userId } = auth;
  const { id } = await params;
  const { data: order } = await db.from("orders").select("id, customer_id, sku_id, status, allocations(lot_id, lots(expiry_date))").eq("id", id).single();
  if (!order) return fail("ORDER_NOT_FOUND", 404);
  // conditional status change first, so a double click cannot write the history twice
  const { data: moved } = await db.from("orders").update({ status: "SHIPPED" }).eq("id", id).eq("status", "ALLOCATED").select("id");
  if (!moved?.length) return fail("ORDER_NOT_ALLOCATED", 409, { message: `受注状態が ${order.status} のため納品確定できません` });

  const now = new Date().toISOString();
  const rows = (order.allocations as unknown as { lot_id: string; lots: { expiry_date: string } }[]).map((a) => ({
    customer_id: order.customer_id, sku_id: order.sku_id, lot_id: a.lot_id, expiry_date: a.lots.expiry_date, received_at: now, source: "SYSTEM",
  }));
  const { error } = await db.from("delivery_history").insert(rows);
  if (error) return fail(error.message, 500);
  await audit(db, userId, "DELIVERED", "order", id, { lots: rows.length, mock: "POD" });
  return ok({ status: "SHIPPED", history: rows.length });
}
