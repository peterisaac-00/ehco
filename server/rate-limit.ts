type RateLimitInput = {
  scope: string;
  key: string;
  limit: number;
  windowMs: number;
};

type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };
type RateLimitEntry = { count: number; resetAt: number };

const buckets = new Map<string, RateLimitEntry>();

/** A bounded in-memory MVP limiter for auth and AI-cost-sensitive routes. */
export function consumeRateLimit({ scope, key, limit, windowMs }: RateLimitInput): RateLimitResult {
  const now = Date.now();
  const bucketKey = `${scope}:${key}`;
  const current = buckets.get(bucketKey);
  if (!current || current.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  if (current.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }
  current.count += 1;
  return { allowed: true };
}
