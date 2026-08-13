import { describe, expect, it } from "vitest";
import { consumeRateLimit } from "../server/rate-limit";

describe("security rate limit", () => {
  it("allows requests inside the configured window and rejects the next request", () => {
    const scope = `test-${Date.now()}`;
    expect(consumeRateLimit({ scope, key: "user", limit: 2, windowMs: 60_000 }).allowed).toBe(true);
    expect(consumeRateLimit({ scope, key: "user", limit: 2, windowMs: 60_000 }).allowed).toBe(true);
    const blocked = consumeRateLimit({ scope, key: "user", limit: 2, windowMs: 60_000 });
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });
});
