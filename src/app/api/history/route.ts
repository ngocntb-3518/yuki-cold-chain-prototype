// Accepted delivery history per customer x SKU (SCR-04-03, replaces FORM-HIST-01)
import { ok, withUser } from "@/lib/api-helpers";

export async function GET(req: Request) {
  const auth = await withUser();
  if ("error" in auth) return auth.error;
  const p = new URL(req.url).searchParams;
  let q = auth.db.from("delivery_history").select("*, customers(name), skus(name), lots(lot_code)").order("received_at", { ascending: false }).limit(200);
  if (p.get("customer")) q = q.eq("customer_id", p.get("customer")!);
  if (p.get("sku")) q = q.eq("sku_id", p.get("sku")!);
  const { data, error } = await q;
  if (error) return ok({ error: error.message }, 500);
  return ok({ history: data });
}
