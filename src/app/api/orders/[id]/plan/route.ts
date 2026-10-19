// Allocation preview (SCR-04-01): every candidate lot with its exclusion reason, in FEFO order, plus proposed picks
import { fail, ok, withUser } from "@/lib/api-helpers";
import { buildOrderPlan } from "@/lib/allocation-service";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const result = await buildOrderPlan(auth.db, id);
  if (!result.ok) return fail(result.error, 404);
  return ok(result);
}
