// Temperature alarm queue (SCR-08-02, FR-TEMP-03): unacknowledged first, with the 15-minute review deadline
import { ok, withUser } from "@/lib/api-helpers";

const REVIEW_SLA_MIN = 15; // BR-HACCP-01: first review within 15 minutes (Yuki policy)

export async function GET() {
  const auth = await withUser();
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.db.from("temp_alarms").select("*").order("acknowledged_at", { ascending: true, nullsFirst: true }).order("created_at", { ascending: false });
  if (error) return ok({ error: error.message }, 500);
  const now = Date.now();
  const alarms = (data ?? []).map((a) => {
    const deadline = Date.parse(a.created_at) + REVIEW_SLA_MIN * 60_000;
    const reviewedLate = a.acknowledged_at ? Date.parse(a.acknowledged_at) > deadline : null;
    return { ...a, deadline: new Date(deadline).toISOString(), overdue: !a.acknowledged_at && now > deadline, reviewedLate };
  });
  return ok({ alarms, serverNow: new Date(now).toISOString() });
}
