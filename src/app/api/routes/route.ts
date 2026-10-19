// Route list with driver-hours check results (SCR-07-01 / SCR-07-02)
import { fail, ok, withUser } from "@/lib/api-helpers";
import { loadRoutesWithChecks } from "@/lib/route-service";

export async function GET() {
  const auth = await withUser();
  if ("error" in auth) return auth.error;
  try {
    return ok({ routes: await loadRoutesWithChecks(auth.db) });
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}
