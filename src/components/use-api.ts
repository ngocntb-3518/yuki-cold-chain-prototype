"use client";
// Minimal data hooks for pages: every read and write goes through the Next.js API routes (never straight to Supabase).
import { useCallback, useEffect, useState } from "react";

export function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const reload = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    try {
      const res = await fetch(url, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok || body.error) throw new Error(body.detail?.message ?? body.error ?? res.statusText);
      setData(body);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [url]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, error, loading, reload };
}

/** POST/PATCH JSON; returns the parsed body and a readable error message (Japanese detail when the API provides one). */
export async function sendJson(url: string, body: unknown = {}, method = "POST") {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  const missing = json.detail?.missing ? `未入力：${json.detail.missing.join("、")}` : null;
  const error = res.ok ? null : missing ?? json.detail?.message ?? json.error ?? res.statusText;
  return { ok: res.ok, json, error: error as string | null };
}
