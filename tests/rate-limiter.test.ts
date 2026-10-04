import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { RateLimiter, getClientIp, getRateLimitHeaders } from "../src/lib/security/rate-limiter";

describe("Rate Limiting & DoS Protection", () => {
  let limiter: RateLimiter;
  let originalDateNow: typeof Date.now;
  let simulatedTime: number;

  beforeEach(() => {
    originalDateNow = Date.now;
    simulatedTime = 1_700_000_000_000;
    Date.now = () => simulatedTime;

    limiter = new RateLimiter({
      windowMs: 60_000, // 1 minute
      maxRequests: 3, // 3 requests max
    });
  });

  afterEach(() => {
    Date.now = originalDateNow;
    limiter.stop();
  });

  it("should allow requests under the limit and decrement remaining", () => {
    const ip = "192.168.1.100";

    const r1 = limiter.check(ip);
    assert.strictEqual(r1.success, true);
    assert.strictEqual(r1.remaining, 2);

    const r2 = limiter.check(ip);
    assert.strictEqual(r2.success, true);
    assert.strictEqual(r2.remaining, 1);

    const r3 = limiter.check(ip);
    assert.strictEqual(r3.success, true);
    assert.strictEqual(r3.remaining, 0);
  });

  it("should block requests when limit is exceeded and provide retryAfter", () => {
    const ip = "192.168.1.101";

    limiter.check(ip);
    limiter.check(ip);
    limiter.check(ip);

    // 4th request -> blocked
    const r4 = limiter.check(ip);
    assert.strictEqual(r4.success, false);
    assert.strictEqual(r4.remaining, 0);
    assert.ok(r4.retryAfter > 0);

    const headers = getRateLimitHeaders(r4);
    assert.strictEqual(headers["X-RateLimit-Limit"], "3");
    assert.strictEqual(headers["X-RateLimit-Remaining"], "0");
    assert.ok(headers["Retry-After"]);
  });

  it("should slide window and allow new requests after time passes", () => {
    const ip = "192.168.1.102";

    limiter.check(ip);
    limiter.check(ip);
    limiter.check(ip);

    assert.strictEqual(limiter.check(ip).success, false);

    // Fast-forward 61 seconds
    simulatedTime += 61_000;

    // Window has rolled over
    const rAfter = limiter.check(ip);
    assert.strictEqual(rAfter.success, true);
    assert.strictEqual(rAfter.remaining, 2);
  });

  it("should isolate limits between different IP addresses", () => {
    const ip1 = "10.0.0.1";
    const ip2 = "10.0.0.2";

    limiter.check(ip1);
    limiter.check(ip1);
    limiter.check(ip1);

    assert.strictEqual(limiter.check(ip1).success, false);
    assert.strictEqual(limiter.check(ip2).success, true);
  });

  it("should extract client IP from headers safely", () => {
    const req1 = new Request("http://localhost:3000/api/secrets", {
      headers: { "x-forwarded-for": "203.0.113.195, 70.41.3.18, 150.172.238.178" },
    });
    assert.strictEqual(getClientIp(req1), "203.0.113.195");

    const req2 = new Request("http://localhost:3000/api/secrets", {
      headers: { "x-real-ip": "198.51.100.42" },
    });
    assert.strictEqual(getClientIp(req2), "198.51.100.42");

    const req3 = new Request("http://localhost:3000/api/secrets");
    assert.strictEqual(getClientIp(req3), "127.0.0.1");
  });
});
