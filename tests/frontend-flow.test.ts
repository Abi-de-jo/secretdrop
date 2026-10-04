import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { encryptSecret, decryptSecret, createSecretShareUrl, parseSecretShareUrl } from "../src/lib/crypto/web-crypto";
import { POST as createSecretRoute } from "../src/app/api/secrets/route";
import { GET as getSecretRoute, DELETE as deleteSecretRoute } from "../src/app/api/secrets/[id]/route";
import { GET as getSecretMetaRoute } from "../src/app/api/secrets/[id]/meta/route";
import { secretStore } from "../src/lib/store/secret-store";
import { createSecretLimiter, readSecretLimiter } from "../src/lib/security/rate-limiter";

describe("Frontend Client Crypto & Full E2E Flow", () => {
  beforeEach(() => {
    secretStore.clear();
    createSecretLimiter.reset();
    readSecretLimiter.reset();
  });

  it("should complete standard secret flow: client encrypt -> POST -> share URL -> meta check -> reveal & decrypt -> verify burned", async () => {
    const rawPlaintext = "CONFIDENTIAL_API_KEY_sk-live-992837482910";

    // 1. Client-side encryption
    const encrypted = await encryptSecret(rawPlaintext);
    assert.ok(encrypted.ciphertext);
    assert.ok(encrypted.iv);
    assert.ok(encrypted.key);
    assert.strictEqual(encrypted.salt, undefined);

    // 2. Client posts ciphertext to server
    const createReq = new Request("http://localhost:3000/api/secrets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        burnAfterRead: true,
        maxViews: 1,
        expiresIn: 3600,
      }),
    });

    const createRes = await createSecretRoute(createReq);
    assert.strictEqual(createRes.status, 201);
    const createdJson = await createRes.json();
    assert.ok(createdJson.id);

    // 3. Share URL generated in client
    const shareUrl = createSecretShareUrl("http://localhost:3000", createdJson.id, encrypted.key!);
    assert.strictEqual(shareUrl, `http://localhost:3000/secret/${createdJson.id}#${encrypted.key}`);

    // 4. Recipient loads page and checks metadata without burning
    const parsed = parseSecretShareUrl(shareUrl);
    assert.strictEqual(parsed.id, createdJson.id);
    assert.strictEqual(parsed.key, encrypted.key);

    const metaReq = new Request(`http://localhost:3000/api/secrets/${createdJson.id}/meta`);
    const metaRes = await getSecretMetaRoute(metaReq, { params: Promise.resolve({ id: createdJson.id }) });
    assert.strictEqual(metaRes.status, 200);
    const metaJson = await metaRes.json();
    assert.strictEqual(metaJson.id, createdJson.id);
    assert.strictEqual(metaJson.burnAfterRead, true);
    assert.strictEqual(metaJson.remainingViews, 1);
    assert.strictEqual(metaJson.hasPassphrase, false);

    // 5. Recipient confirms and reveals secret
    const revealReq = new Request(`http://localhost:3000/api/secrets/${createdJson.id}`);
    const revealRes = await getSecretRoute(revealReq, { params: Promise.resolve({ id: createdJson.id }) });
    assert.strictEqual(revealRes.status, 200);
    const consumedJson = await revealRes.json();
    assert.strictEqual(consumedJson.ciphertext, encrypted.ciphertext);
    assert.strictEqual(consumedJson.iv, encrypted.iv);
    assert.strictEqual(consumedJson.isBurned, true);

    // 6. Client decrypts with hash key
    const decrypted = await decryptSecret(consumedJson.ciphertext, consumedJson.iv, parsed.key!);
    assert.strictEqual(decrypted, rawPlaintext);

    // 7. Verify secret is permanently destroyed
    const secondReq = new Request(`http://localhost:3000/api/secrets/${createdJson.id}`);
    const secondRes = await getSecretRoute(secondReq, { params: Promise.resolve({ id: createdJson.id }) });
    assert.strictEqual(secondRes.status, 404);
  });

  it("should complete passphrase-protected secret flow with PBKDF2 derivation", async () => {
    const rawPlaintext = "SUPER_SECRET_DATABASE_PASSWORD_$$1234";
    const passphrase = "MySecureCustomPassphrase!2026";

    // 1. Client-side passphrase encryption
    const encrypted = await encryptSecret(rawPlaintext, { passphrase });
    assert.ok(encrypted.ciphertext);
    assert.ok(encrypted.iv);
    assert.ok(encrypted.salt);
    assert.strictEqual(encrypted.key, undefined);

    // 2. Post to API
    const createReq = new Request("http://localhost:3000/api/secrets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        salt: encrypted.salt,
        burnAfterRead: true,
        maxViews: 1,
      }),
    });

    const createRes = await createSecretRoute(createReq);
    assert.strictEqual(createRes.status, 201);
    const createdJson = await createRes.json();

    // 3. Metadata check reflects passphrase requirement
    const metaReq = new Request(`http://localhost:3000/api/secrets/${createdJson.id}/meta`);
    const metaRes = await getSecretMetaRoute(metaReq, { params: Promise.resolve({ id: createdJson.id }) });
    assert.strictEqual(metaRes.status, 200);
    const metaJson = await metaRes.json();
    assert.strictEqual(metaJson.hasPassphrase, true);

    // 4. Reveal & Decrypt with passphrase
    const revealReq = new Request(`http://localhost:3000/api/secrets/${createdJson.id}`);
    const revealRes = await getSecretRoute(revealReq, { params: Promise.resolve({ id: createdJson.id }) });
    assert.strictEqual(revealRes.status, 200);
    const consumedJson = await revealRes.json();

    const decrypted = await decryptSecret(
      consumedJson.ciphertext,
      consumedJson.iv,
      passphrase,
      { salt: consumedJson.salt, passphrase }
    );
    assert.strictEqual(decrypted, rawPlaintext);
  });

  it("should allow creator to manually revoke/destroy a secret before recipient reads it", async () => {
    const encrypted = await encryptSecret("TOP_SECRET_TO_REVOKE");

    const createReq = new Request("http://localhost:3000/api/secrets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
      }),
    });

    const createRes = await createSecretRoute(createReq);
    const createdJson = await createRes.json();

    // Creator revokes secret
    const deleteReq = new Request(`http://localhost:3000/api/secrets/${createdJson.id}`, { method: "DELETE" });
    const deleteRes = await deleteSecretRoute(deleteReq, { params: Promise.resolve({ id: createdJson.id }) });
    assert.strictEqual(deleteRes.status, 200);

    // Recipient tries to load meta or get secret -> 404
    const metaReq = new Request(`http://localhost:3000/api/secrets/${createdJson.id}/meta`);
    const metaRes = await getSecretMetaRoute(metaReq, { params: Promise.resolve({ id: createdJson.id }) });
    assert.strictEqual(metaRes.status, 404);
  });
});
