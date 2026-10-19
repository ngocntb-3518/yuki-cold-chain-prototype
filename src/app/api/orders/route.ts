// Order list for allocation (SCR-05-01 / SCR-04-01)
import { ok, withUser } from "@/lib/api-helpers";

export async function GET() {
  const auth = await withUser();
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.db
    .from("orders")
    .select("*, customers(name), skus(name, expiry_type), allocations(id, qty, lots(lot_code, expiry_date))")
    .order("id");
  if (error) return ok({ error: error.message }, 500);
  return ok({ orders: data });
}
