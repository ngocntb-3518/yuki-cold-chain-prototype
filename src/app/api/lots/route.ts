// Inventory search (SCR-03-07): lots with SKU, filterable by status / SKU / text
import { ok, withUser } from "@/lib/api-helpers";

export async function GET(req: Request) {
  const auth = await withUser();
  if ("error" in auth) return auth.error;
  const p = new URL(req.url).searchParams;
  let q = auth.db.from("lots").select("*, skus(name, zone, expiry_type, trace_lane)").order("expiry_date");
  if (p.get("status")) q = q.eq("status", p.get("status")!);
  if (p.get("sku")) q = q.eq("sku_id", p.get("sku")!);
  if (p.get("q")) q = q.ilike("lot_code", `%${p.get("q")}%`);
  const { data, error } = await q;
  if (error) return ok({ error: error.message }, 500);
  return ok({ lots: data });
}
