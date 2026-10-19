// Execute allocation (FR-OUT-02): re-evaluate on the server (never trust the client's preview), then decrement each
// lot atomically through the allocate_lot() database function. Missing agreement rule -> BUSINESS_REVIEW, no allocation.
import { audit, fail, ok, withUser } from "@/lib/api-helpers";
import { buildOrderPlan } from "@/lib/allocation-service";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withUser();
  if ("error" in auth) return auth.error;
  const { db, userId } = auth;
  const { id } = await params;
  const result = await buildOrderPlan(db, id);
  if (!result.ok) return fail(result.error, 404);
  const { order, plan, ctx } = result;
  if (order.status !== "OPEN") return fail("ORDER_NOT_OPEN", 409, { message: `受注状態が ${order.status} のため引当できません` });

  if (plan.status === "BUSINESS_REVIEW") {
    await db.from("orders").update({ status: "BUSINESS_REVIEW" }).eq("id", id);
    await audit(db, userId, "BUSINESS_REVIEW", "order", id, { reason: "agreement window rule not configured" });
    return ok({ status: "BUSINESS_REVIEW" });
  }
  if (plan.status === "SHORT") return fail("INSUFFICIENT_STOCK", 409, { shortBy: plan.shortBy, message: `引当可能数量が ${plan.shortBy} 不足` });

  const decision = { rules: ctx, evaluatedAt: new Date().toISOString(), excluded: plan.evaluations.filter((e) => e.excluded).map((e) => ({ lot: e.lot.lotCode, code: e.excluded })) };
  // all picks in one database transaction: either the whole order is allocated or nothing changes
  const { error } = await db.rpc("allocate_order", { p_order_id: id, p_picks: plan.picks, p_decision: decision });
  if (error) {
    const lot = error.message.split("LOT_NOT_AVAILABLE:")[1];
    return fail("ALLOCATION_CONFLICT", 409, { message: lot ? `ロット ${lot} は他の引当で使用されました。再評価してください` : "受注は既に引当済みです" });
  }
  return ok({ status: "ALLOCATED", picks: plan.picks });
}
