import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { MemorySecretStore } from "../src/lib/store/secret-store";

describe("Secret Store & Lifecycle Policy", () => {
  let store: MemorySecretStore;
  let originalDateNow: typeof Date.now;
  let simulatedTime: number;

  beforeEach(() => {
    originalDateNow = Date.now;
    simulatedTime = 1_700_000_000_000;
    Date.now = () => simulatedTime;

    store = new MemorySecretStore({
      defaultTtlSeconds: 3600,
      minTtlSeconds: 1,
      maxTtlSeconds: 86400,
      maxCapacity: 10,
    });
  });

  afterEach(() => {
    Date.now = originalDateNow;
    store.stopPeriodicCleanup();
  });

  it("should create and store a secret record with default burnAfterRead", async () => {
    const record = await store.createSecret({
      ciphertext: "test_ciphertext_abc123",
      iv: "test_iv_123456",
      burnAfterRead: true,
      expiresIn: 300,
    });

    assert.ok(record.id);
    assert.strictEqual(record.ciphertext, "test_ciphertext_abc123");
    assert.strictEqual(record.iv, "test_iv_123456");
    assert.strictEqual(record.burnAfterRead, true);
    assert.strictEqual(record.maxViews, 1);
    assert.strictEqual(record.remainingViews, 1);
  });

  it("should atomically consume and burn secret on first read when burnAfterRead is true", async () => {
    const record = await store.createSecret({
      ciphertext: "sensitive_data_xyz",
      iv: "iv_xyz",
      burnAfterRead: true,
    });

    // 1st Read -> Should succeed and mark burned
    const firstRead = await store.getAndConsumeSecret(record.id);
    assert.ok(firstRead);
    assert.strictEqual(firstRead.ciphertext, "sensitive_data_xyz");
    assert.strictEqual(firstRead.isBurned, true);
    assert.strictEqual(firstRead.remainingViews, 0);

    // 2nd Read -> Should return null (already burned and wiped)
    const secondRead = await store.getAndConsumeSecret(record.id);
    assert.strictEqual(secondRead, null);
  });

  it("should support multiple allowed views before burning", async () => {
    const record = await store.createSecret({
      ciphertext: "multi_view_payload",
      iv: "iv_multi",
      burnAfterRead: false,
      maxViews: 3,
    });

    // 1st Read
    const read1 = await store.getAndConsumeSecret(record.id);
    assert.ok(read1);
    assert.strictEqual(read1.isBurned, false);
    assert.strictEqual(read1.remainingViews, 2);

    // 2nd Read
    const read2 = await store.getAndConsumeSecret(record.id);
    assert.ok(read2);
    assert.strictEqual(read2.isBurned, false);
    assert.strictEqual(read2.remainingViews, 1);

    // 3rd Read -> final view, should burn
    const read3 = await store.getAndConsumeSecret(record.id);
    assert.ok(read3);
    assert.strictEqual(read3.isBurned, true);
    assert.strictEqual(read3.remainingViews, 0);

    // 4th Read -> null
    const read4 = await store.getAndConsumeSecret(record.id);
    assert.strictEqual(read4, null);
  });

  it("should expire secrets past their TTL", async () => {
    const record = await store.createSecret({
      ciphertext: "expiring_secret",
      iv: "expiring_iv",
      expiresIn: 60, // 60 seconds
    });

    // Fast-forward simulated time past expiration
    simulatedTime += 61 * 1000;

    // Secret should now be expired and return null
    const result = await store.getAndConsumeSecret(record.id);
    assert.strictEqual(result, null);
  });

  it("should query metadata without consuming the secret", async () => {
    const record = await store.createSecret({
      ciphertext: "meta_test_ciphertext",
      iv: "meta_iv",
      burnAfterRead: true,
      maxViews: 1,
    });

    const meta = await store.getSecretMeta(record.id);
    assert.ok(meta);
    assert.strictEqual(meta.id, record.id);
    assert.strictEqual(meta.maxViews, 1);
    assert.strictEqual(meta.remainingViews, 1);
    assert.strictEqual(meta.isBurned, false);

    // After querying meta, secret should still be consumable
    const secret = await store.getAndConsumeSecret(record.id);
    assert.ok(secret);
    assert.strictEqual(secret.ciphertext, "meta_test_ciphertext");
  });

  it("should manually delete/burn a secret", async () => {
    const record = await store.createSecret({
      ciphertext: "manual_burn_secret",
      iv: "manual_iv",
    });

    const deleted = await store.deleteSecret(record.id);
    assert.strictEqual(deleted, true);

    const check = await store.getAndConsumeSecret(record.id);
    assert.strictEqual(check, null);
  });

  it("should clean up expired secrets and track statistics", async () => {
    await store.createSecret({
      ciphertext: "exp1",
      iv: "iv1",
      expiresIn: 60,
    });
    await store.createSecret({
      ciphertext: "exp2",
      iv: "iv2",
      expiresIn: 3600,
    });

    // Fast forward past 60s
    simulatedTime += 70 * 1000;

    const cleaned = store.cleanupExpiredSecrets();
    assert.strictEqual(cleaned, 1);

    const stats = store.getStats();
    assert.strictEqual(stats.activeSecrets, 1);
    assert.strictEqual(stats.totalCreated, 2);
  });
});
