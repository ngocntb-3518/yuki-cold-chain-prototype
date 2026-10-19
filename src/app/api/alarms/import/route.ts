// Logger CSV import (SCR-08-01, FR-TEMP-01/02, IF-LOG-01 simplified): evaluates readings against the zone's current
// policy and creates one alarm per excursion. Real system: file hash + idempotency, original file archive, device timezone.
import { audit, fail, ok, withUser } from "@/lib/api-helpers";
import { findExcursions, parseLoggerCsv } from "@/lib/rules/temperature-rules";

const LOGGER_ZONE: Record<string, string> = { "DL-A01": "AMBIENT", "DL-C01": "CHILLED", "DL-F01": "FROZEN" };

export async function POST(req: Request) {
  const auth = await withUser();
  if ("error" in auth) return auth.error;
  const { db, userId } = auth;
  const { logger, csv, fileName } = await req.json().catch(() => ({}));
  const zone = LOGGER_ZONE[logger];
  if (!zone) return fail("UNKNOWN_LOGGER", 422);
  if (!String(csv ?? "").trim()) return fail("EMPTY_FILE", 422);

  const { data: policy } = await db.from("zone_policies").select("*").eq("zone", zone).single();
  if (!policy) return fail("POLICY_NOT_FOUND", 500);
  const { readings, rejected } = parseLoggerCsv(String(csv));
  const excursions = findExcursions(readings, policy);
  if (excursions.length) {
    const { error } = await db.from("temp_alarms").insert(excursions.map((e) => ({
      logger, zone, first_at: e.firstAt, last_at: e.lastAt, peak_c: e.peak, policy_version: policy.policy_version, source_file: fileName ?? null,
    })));
    if (error) return fail(error.message, 500);
  }
  await audit(db, userId, "LOGGER_IMPORT", "logger", logger, { readings: readings.length, rejected, excursions: excursions.length });
  return ok({ readings: readings.length, rejectedLines: rejected, alarmsCreated: excursions.length });
}
