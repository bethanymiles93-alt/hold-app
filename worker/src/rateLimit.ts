/**
 * Per-install monthly draft safety cap, backed by Workers KV — not a
 * free-tier allowance (AI drafting is Hold+-only, gated in draftService.ts).
 * Keyed by an anonymous UUID the app generates once and stores in
 * SecureStore — no name, phone number, or other identifying data ever
 * reaches this layer.
 */

const KV_TTL_SECONDS = 60 * 60 * 24 * 40; // ~40 days — outlives the month it counts, then falls away on its own.

function monthKey(installId: string, now: Date): string {
  const yearMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return `usage:${installId}:${yearMonth}`;
}

export interface RateLimitResult {
  allowed: boolean;
  used: number;
  limit: number;
}

export async function checkAndIncrement(
  kv: KVNamespace,
  installId: string,
  limit: number
): Promise<RateLimitResult> {
  const key = monthKey(installId, new Date());
  const raw = await kv.get(key);
  const used = raw ? Number.parseInt(raw, 10) : 0;

  if (used >= limit) {
    return { allowed: false, used, limit };
  }

  await kv.put(key, String(used + 1), { expirationTtl: KV_TTL_SECONDS });
  return { allowed: true, used: used + 1, limit };
}
