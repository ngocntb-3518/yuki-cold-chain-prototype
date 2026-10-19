// Traceability search (SCR-09-01, FR-TRC-01): from a lot code, a 10-digit beef ID or rice origin text to the lot,
// its allocations/orders and the customers it was delivered to.
import { fail, ok, withUser } from "@/lib/api-helpers";

export async function GET(req: Request) {
  const auth = await withUser();
  if ("error" in auth) return auth.error;
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return fail("QUERY_TOO_SHORT", 422);
  // escape PostgREST filter syntax characters before building the or() filter
  const safe = q.replace(/[,()*%]/g, "");
  const { data: lots, error } = await auth.db
    .from("lots")
    .select("id, lot_code, sku_id, supplier, mfg_date, expiry_date, status, location, beef_id, rice_origin, qty_received, skus(name, trace_lane), allocations(qty, order_id, orders(customer_id, status, customers(name))), delivery_history(customer_id, received_at, customers(name))")
    .or(`lot_code.ilike.%${safe}%,beef_id.eq.${safe},rice_origin.ilike.%${safe}%`)
    .limit(20);
  if (error) return fail(error.message, 500);
  return ok({ lots });
}
