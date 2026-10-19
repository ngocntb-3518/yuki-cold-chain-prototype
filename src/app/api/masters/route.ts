// Master data (read-only in the prototype): SKUs, customers, agreements, temperature policies
import { ok, withUser } from "@/lib/api-helpers";

export async function GET() {
  const auth = await withUser();
  if ("error" in auth) return auth.error;
  const { db } = auth;
  const [skus, customers, agreements, policies] = await Promise.all([
    db.from("skus").select("*").order("id"),
    db.from("customers").select("*").order("id"),
    db.from("agreements").select("*, customers(name), skus(name)").order("id"),
    db.from("zone_policies").select("*").order("zone"),
  ]);
  const error = skus.error ?? customers.error ?? agreements.error ?? policies.error;
  if (error) return ok({ error: error.message }, 500);
  return ok({ skus: skus.data, customers: customers.data, agreements: agreements.data, policies: policies.data });
}
