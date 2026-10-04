import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { POST as createSecretRoute } from "../src/app/api/secrets/route";
import { GET as getSecretRoute, DELETE as deleteSecretRoute } from "../src/app/api/secrets/[id]/route";
import { GET as getSecretMetaRoute } from "../src/app/api/secrets/[id]/meta/route";
import { secretStore } from "../src/lib/store/secret-store";
import { createSecretLimiter, readSecretLimiter } from "../src/lib/security/rate-limiter";

describe("API Route Handlers - End-to-End Secret Flow", () => {
  beforeEach(() => {
    secretStore.clear();
    createSecretLimiter.reset();
    readSecretLimiter.reset();
  });

  it("should create secret via POST /api/secrets and return 201 with headers", async () => {
    const payload = {
      ciphertext: "test_encrypted_ciphertext_base64url",
      iv: "test_iv_base64url",
      burnAfterRead: true,
      expiresIn: 3600,
    };

    const req = new Request("http://localhost:3000/api/secrets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "10.0.0.1",
      },
      body: JSON.stringify(payload),
    });

    const res = await createSecretRoute(req);
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.headers.get("X-Content-Type-Options"), "nosniff");
    assert.strictEqual(res.headers.get("X-Frame-Options"), "DENY");
    assert.strictEqual(res.headers.get("Referrer-Policy"), "no-referrer");

    const json = await res.json();
    assert.ok(json.id);
    assert.strictEqual(json.burnAfterRead, true);
    assert.strictEqual(json.maxViews, 1);
    assert.ok(json.expiresAt);
  });

  it("should reject POST /api/secrets with invalid JSON or payload (400 Bad Request)", async () => {
    const badReq = new Request("http://localhost:3000/api/secrets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "10.0.0.2",
      },
      body: JSON.stringify({ ciphertext: "" }), // missing iv & empty ciphertext
    });

    const res = await createSecretRoute(badReq);
    assert.strictEqual(res.status, 400);

    const json = await res.json();
    assert.ok(json.error);
  });

  it("should retrieve and burn secret via GET /api/secrets/:id (single view)", async () => {
    // 1. Create Secret
    const createReq = new Request("http://localhost:3000/api/secrets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "10.0.0.3",
      },
      body: JSON.stringify({
        ciphertext: "my_confidential_ciphertext",
        iv: "my_iv_123456",
        burnAfterRead: true,
      }),
    });

    const createRes = await createSecretRoute(createReq);
    const { id } = await createRes.json();

    // 2. Query meta first (should not burn)
    const metaReq = new Request(`http://localhost:3000/api/secrets/${id}/meta`, {
      headers: { "x-forwarded-for": "10.0.0.4" },
    });
    const metaRes = await getSecretMetaRoute(metaReq, {
      params: Promise.resolve({ id }),
    });
    assert.strictEqual(metaRes.status, 200);
    const metaJson = await metaRes.json();
    assert.strictEqual(metaJson.id, id);
    assert.strictEqual(metaJson.burnAfterRead, true);

    // 3. Read & Burn via GET /api/secrets/:id
    const getReq = new Request(`http://localhost:3000/api/secrets/${id}`, {
      headers: { "x-forwarded-for": "10.0.0.5" },
    });
    const getRes = await getSecretRoute(getReq, {
      params: Promise.resolve({ id }),
    });
    assert.strictEqual(getRes.status, 200);
    assert.strictEqual(getRes.headers.get("X-Secret-Burned"), "true");

    const getJson = await getRes.json();
    assert.strictEqual(getJson.ciphertext, "my_confidential_ciphertext");
    assert.strictEqual(getJson.iv, "my_iv_123456");
    assert.strictEqual(getJson.isBurned, true);

    // 4. Second GET -> Must return 404 (burned)
    const getAgainReq = new Request(`http://localhost:3000/api/secrets/${id}`, {
      headers: { "x-forwarded-for": "10.0.0.5" },
    });
    const getAgainRes = await getSecretRoute(getAgainReq, {
      params: Promise.resolve({ id }),
    });
    assert.strictEqual(getAgainRes.status, 404);
  });

  it("should manually delete/burn secret via DELETE /api/secrets/:id", async () => {
    // 1. Create Secret
    const createReq = new Request("http://localhost:3000/api/secrets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "10.0.0.6",
      },
      body: JSON.stringify({
        ciphertext: "secret_to_be_manually_burned",
        iv: "iv_manual",
      }),
    });

    const createRes = await createSecretRoute(createReq);
    const { id } = await createRes.json();

    // 2. DELETE /api/secrets/:id
    const deleteReq = new Request(`http://localhost:3000/api/secrets/${id}`, {
      method: "DELETE",
      headers: { "x-forwarded-for": "10.0.0.7" },
    });
    const deleteRes = await deleteSecretRoute(deleteReq, {
      params: Promise.resolve({ id }),
    });
    assert.strictEqual(deleteRes.status, 200);

    // 3. GET should return 404
    const getReq = new Request(`http://localhost:3000/api/secrets/${id}`, {
      headers: { "x-forwarded-for": "10.0.0.7" },
    });
    const getRes = await getSecretRoute(getReq, {
      params: Promise.resolve({ id }),
    });
    assert.strictEqual(getRes.status, 404);
  });

  it("should enforce rate limiting on API routes (429)", async () => {
    const spamIp = "192.0.2.99";

    // Exhaust create limit (30 requests)
    for (let i = 0; i < 30; i++) {
      const req = new Request("http://localhost:3000/api/secrets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": spamIp,
        },
        body: JSON.stringify({
          ciphertext: `spam_payload_${i}`,
          iv: "iv_spam",
        }),
      });
      const res = await createSecretRoute(req);
      assert.strictEqual(res.status, 201);
    }

    // 31st request -> Rate limited (429)
    const blockedReq = new Request("http://localhost:3000/api/secrets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": spamIp,
      },
      body: JSON.stringify({
        ciphertext: "blocked_payload",
        iv: "iv_blocked",
      }),
    });
    const blockedRes = await createSecretRoute(blockedReq);
    assert.strictEqual(blockedRes.status, 429);
    assert.ok(blockedRes.headers.get("Retry-After"));
  });
});
