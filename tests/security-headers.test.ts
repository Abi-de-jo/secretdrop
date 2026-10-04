import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SECURITY_HEADERS,
  EPHEMERAL_CACHE_HEADERS,
  applySecurityHeaders,
} from "../src/lib/security/headers";

describe("Security Headers Audit & Configuration", () => {
  it("should define all required production security headers", () => {
    assert.strictEqual(SECURITY_HEADERS["X-Content-Type-Options"], "nosniff");
    assert.strictEqual(SECURITY_HEADERS["X-Frame-Options"], "DENY");
    assert.strictEqual(SECURITY_HEADERS["Referrer-Policy"], "no-referrer");
    assert.ok(SECURITY_HEADERS["Strict-Transport-Security"].includes("max-age=63072000"));
    assert.ok(SECURITY_HEADERS["Strict-Transport-Security"].includes("includeSubDomains"));
    assert.ok(SECURITY_HEADERS["Strict-Transport-Security"].includes("preload"));
    assert.strictEqual(SECURITY_HEADERS["Cross-Origin-Opener-Policy"], "same-origin");
    assert.strictEqual(SECURITY_HEADERS["Cross-Origin-Resource-Policy"], "same-origin");
    assert.strictEqual(SECURITY_HEADERS["X-XSS-Protection"], "0");
  });

  it("should have comprehensive Content-Security-Policy directives", () => {
    const csp = SECURITY_HEADERS["Content-Security-Policy"];
    assert.ok(csp.includes("default-src 'self'"));
    assert.ok(csp.includes("frame-ancestors 'none'"));
    assert.ok(csp.includes("base-uri 'self'"));
    assert.ok(csp.includes("form-action 'self'"));
    assert.ok(csp.includes("object-src 'none'"));
    assert.ok(csp.includes("upgrade-insecure-requests"));
  });

  it("should define ephemeral no-cache headers for secrets", () => {
    assert.ok(EPHEMERAL_CACHE_HEADERS["Cache-Control"].includes("no-store"));
    assert.ok(EPHEMERAL_CACHE_HEADERS["Cache-Control"].includes("no-cache"));
    assert.ok(EPHEMERAL_CACHE_HEADERS["Cache-Control"].includes("must-revalidate"));
    assert.strictEqual(EPHEMERAL_CACHE_HEADERS["Pragma"], "no-cache");
    assert.strictEqual(EPHEMERAL_CACHE_HEADERS["Expires"], "0");
  });

  it("should apply security headers correctly to a Response object", () => {
    const rawResponse = new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });

    const secured = applySecurityHeaders(rawResponse, EPHEMERAL_CACHE_HEADERS);

    assert.strictEqual(secured.headers.get("X-Content-Type-Options"), "nosniff");
    assert.strictEqual(secured.headers.get("X-Frame-Options"), "DENY");
    assert.strictEqual(secured.headers.get("Referrer-Policy"), "no-referrer");
    assert.strictEqual(secured.headers.get("Cache-Control"), "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  });
});
