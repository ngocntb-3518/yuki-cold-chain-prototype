// Shared helpers for API route handlers: authenticated Supabase client, JSON responses, audit logging.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type Db = Awaited<ReturnType<typeof createClient>>;

/** Returns the RLS-bound client and the signed-in user id, or a 401 response. */
export async function withUser(): Promise<{ db: Db; userId: string } | { error: NextResponse }> {
  const db = await createClient();
  const { data } = await db.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }) };
  return { db, userId };
}

export const ok = (body: unknown, status = 200) => NextResponse.json(body, { status });
export const fail = (message: string, status = 400, detail?: unknown) => NextResponse.json({ error: message, detail }, { status });

export async function audit(db: Db, actor: string, action: string, entity: string, entityId: string, detail: unknown) {
  await db.from("audit_events").insert({ action, entity, entity_id: entityId, detail, actor });
}

/** Today in JST as YYYY-MM-DD (business dates are JST, NFR-LOC-01). */
export function todayJst(): string {
  return new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
}

export const zoneOfLocation = (location: string): "AMBIENT" | "CHILLED" | "FROZEN" =>
  location.startsWith("A") ? "AMBIENT" : location.startsWith("F") ? "FROZEN" : "CHILLED";
