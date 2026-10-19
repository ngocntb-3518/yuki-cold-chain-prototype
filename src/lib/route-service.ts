// Loads a route with its legs and the driver's previous route, then runs the driver-hours check.
// Shared by the list API and the publish API so publishing enforces exactly what the planner sees.
import type { Db } from "@/lib/api-helpers";
import { checkRoute, DRIVER_RULE_VERSION, type Leg } from "@/lib/rules/driver-hours-rules";

const DAY_MIN = 24 * 60;
const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const dayDiff = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86_400_000);

type RouteRow = { id: string; driver_id: string; route_date: string; start_time: string; extension_approved: boolean; status: string; rule_version: string | null; published_at: string | null; drivers: { name: string } | null; route_legs: Leg[] };

export async function loadRoutesWithChecks(db: Db, onlyId?: string) {
  const { data, error } = await db.from("routes").select("*, drivers(name), route_legs(seq, kind, minutes, label)").order("route_date").order("id");
  if (error) throw new Error(error.message);
  const routes = (data ?? []) as unknown as RouteRow[];
  return routes
    .filter((r) => !onlyId || r.id === onlyId)
    .map((r) => {
      // previous route of the same driver (any earlier date) -> rest period and 2-day average driving
      const prev = routes
        .filter((p) => p.driver_id === r.driver_id && p.route_date < r.route_date)
        .sort((a, b) => b.route_date.localeCompare(a.route_date))[0];
      const prevDuration = prev ? prev.route_legs.reduce((s, l) => s + l.minutes, 0) : 0;
      const prevEnd = prev ? toMin(prev.start_time) + prevDuration - dayDiff(r.route_date, prev.route_date) * DAY_MIN : null;
      const prevDriving = prev && dayDiff(r.route_date, prev.route_date) === 1
        ? prev.route_legs.filter((l) => l.kind === "DRIVE").reduce((s, l) => s + l.minutes, 0) : null;
      const check = checkRoute({
        startMinOfDay: toMin(r.start_time), legs: r.route_legs, extensionApproved: r.extension_approved,
        previousRouteEndAbsMin: prevEnd, previousDayDrivingMin: prevDriving,
      });
      return { ...r, check, ruleVersion: DRIVER_RULE_VERSION };
    });
}
