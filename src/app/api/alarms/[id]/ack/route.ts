// First review of an alarm (FR-TEMP-03): records who and when; cannot be changed afterwards
import { audit, fail, ok, withUser } from "@/lib/api-helpers";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withUser();
  if ("error" in auth) return auth.error;
  const { db, userId } = auth;
  const { id } = await params;
  const { data, error } = await db.from("temp_alarms").update({ acknowledged_at: new Date().toISOString(), acknowledged_by: userId })
    .eq("id", id).is("acknowledged_at", null).select("id, acknowledged_at").single();
  if (error || !data) return fail("ALREADY_ACKNOWLEDGED", 409);
  await audit(db, userId, "ALARM_ACK", "temp_alarm", id, {});
  return ok({ alarm: data });
}
