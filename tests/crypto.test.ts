import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  encryptSecret,
  decryptSecret,
  generateAesKey,
  exportKeyToBase64Url,
  importKeyFromBase64Url,
  generateSecretId,
  createSecretShareUrl,
  parseSecretShareUrl,
  bytesToBase64Url,
  base64UrlToBytes,
  DecryptionError,
} from "../src/lib/crypto/web-crypto";

describe("Web Crypto - Zero-Knowledge Encryption & Decryption", () => {
  it("should encrypt and decrypt plaintext using auto-generated AES-256-GCM key", async () => {
    const originalText = "TopSecretPassword123!@# with unicode 🔒🔑🚀";
    const encrypted = await encryptSecret(originalText);

    assert.ok(encrypted.ciphertext);
    assert.ok(encrypted.iv);
    assert.ok(encrypted.key);

    const decrypted = await decryptSecret(encrypted.ciphertext, encrypted.iv, encrypted.key);
    assert.strictEqual(decrypted, originalText);
  });

  it("should encrypt and decrypt using an explicitly provided exported key", async () => {
    const key = await generateAesKey(true);
    const exportedKey = await exportKeyToBase64Url(key);

    const message = "Confidential API Key: sk_live_987654321";
    const encrypted = await encryptSecret(message, { key: exportedKey });

    const decrypted = await decryptSecret(encrypted.ciphertext, encrypted.iv, exportedKey);
    assert.strictEqual(decrypted, message);

    // Verify importing the raw key directly
    const importedKey = await importKeyFromBase64Url(exportedKey);
    assert.strictEqual(importedKey.algorithm.name, "AES-GCM");
  });

  it("should encrypt and decrypt with user passphrase (PBKDF2 + AES-GCM)", async () => {
    const message = "Protected with user password";
    const passphrase = "correct-horse-battery-staple";

    const encrypted = await encryptSecret(message, { passphrase });

    assert.ok(encrypted.salt, "Salt must be generated for passphrase protection");
    assert.strictEqual(encrypted.key, undefined, "Random key is omitted when passphrase derived");

    // Decrypt with correct passphrase
    const decrypted = await decryptSecret(encrypted.ciphertext, encrypted.iv, passphrase, {
      salt: encrypted.salt,
    });
    assert.strictEqual(decrypted, message);
  });

  it("should fail decryption when wrong passphrase is provided", async () => {
    const message = "Secret message";
    const passphrase = "correct-passphrase";
    const encrypted = await encryptSecret(message, { passphrase });

    await assert.rejects(
      async () => {
        await decryptSecret(encrypted.ciphertext, encrypted.iv, "wrong-passphrase", {
          salt: encrypted.salt,
        });
      },
      (err: Error) => {
        assert.ok(err instanceof DecryptionError);
        return true;
      }
    );
  });

  it("should fail decryption when invalid key is provided", async () => {
    const originalText = "Classified document";
    const encrypted = await encryptSecret(originalText);

    const differentKey = await generateAesKey(true);
    const wrongKeyString = await exportKeyToBase64Url(differentKey);

    await assert.rejects(
      async () => {
        await decryptSecret(encrypted.ciphertext, encrypted.iv, wrongKeyString);
      },
      (err: Error) => {
        assert.ok(err instanceof DecryptionError);
        return true;
      }
    );
  });

  it("should reject tampered ciphertext due to AES-GCM authentication tag failure", async () => {
    const originalText = "Untampered data";
    const encrypted = await encryptSecret(originalText);

    // Tamper with ciphertext bytes
    const bytes = base64UrlToBytes(encrypted.ciphertext);
    bytes[0] ^= 0xff; // flip bits
    const tamperedCiphertext = bytesToBase64Url(bytes);

    await assert.rejects(
      async () => {
        await decryptSecret(tamperedCiphertext, encrypted.iv, encrypted.key!);
      },
      (err: Error) => {
        assert.ok(err instanceof DecryptionError);
        return true;
      }
    );
  });

  it("should generate cryptographically unique random secret IDs", () => {
    const id1 = generateSecretId();
    const id2 = generateSecretId();

    assert.ok(id1.length >= 20);
    assert.notStrictEqual(id1, id2);
  });

  it("should format and parse zero-knowledge URL with hash fragment", () => {
    const origin = "https://secretdrop.app";
    const id = "sec_123456789";
    const key = "key_abcdef123456";

    const shareUrl = createSecretShareUrl(origin, id, key);
    assert.strictEqual(shareUrl, "https://secretdrop.app/secret/sec_123456789#key_abcdef123456");

    const parsed = parseSecretShareUrl(shareUrl);
    assert.strictEqual(parsed.id, "sec_123456789");
    assert.strictEqual(parsed.key, "key_abcdef123456");

    const parsedFromHashOnly = parseSecretShareUrl("#key_abcdef123456");
    assert.strictEqual(parsedFromHashOnly.key, "key_abcdef123456");
  });
});
