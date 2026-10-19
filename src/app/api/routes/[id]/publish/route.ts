// Publish a route (SCR-07-03, FR-SCH-02/04): re-checked on the server; any blocking violation refuses publication.
// The rule version used is stored with the route so later rule changes never re-evaluate a published route.
import { audit, fail, ok, withUser } from "@/lib/api-helpers";
import { loadRoutesWithChecks } from "@/lib/route-service";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withUser();
  if ("error" in auth) return auth.error;
  const { db, userId } = auth;
  const { id } = await params;
  const [route] = await loadRoutesWithChecks(db, id);
  if (!route) return fail("ROUTE_NOT_FOUND", 404);
  if (route.status !== "DRAFT") return fail("ALREADY_PUBLISHED", 409);
  if (!route.check.publishable)
    return fail("DRIVER_HOURS_VIOLATION", 422, { violations: route.check.violations, message: "拘束時間等の違反があるため公開できません" });

  const { data, error } = await db.from("routes")
    .update({ status: "PUBLISHED", rule_version: route.ruleVersion, published_at: new Date().toISOString() })
    .eq("id", id).eq("status", "DRAFT").select("id, status, rule_version").single();
  if (error || !data) return fail("CONFLICT", 409);
  await audit(db, userId, "ROUTE_PUBLISH", "route", id, { ruleVersion: route.ruleVersion, restraintMin: route.check.restraintMin });
  return ok({ route: data });
}
