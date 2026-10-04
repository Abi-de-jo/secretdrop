import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateCreateSecretInput,
  validateSecretId,
} from "../src/lib/security/validation";

describe("Input Validation & Sanitization", () => {
  it("should accept valid secret creation input", () => {
    const valid = {
      ciphertext: "valid_base64url_ciphertext_12345",
      iv: "valid_base64url_iv",
      salt: "valid_salt_abc",
      burnAfterRead: true,
      expiresIn: 3600,
      maxViews: 5,
    };

    const result = validateCreateSecretInput(valid);
    assert.strictEqual(result.isValid, true);
    assert.deepStrictEqual(result.data, valid);
  });

  it("should reject non-object body", () => {
    assert.strictEqual(validateCreateSecretInput(null).isValid, false);
    assert.strictEqual(validateCreateSecretInput("string").isValid, false);
    assert.strictEqual(validateCreateSecretInput([]).isValid, false);
  });

  it("should reject missing or empty ciphertext", () => {
    assert.strictEqual(validateCreateSecretInput({ iv: "some_iv" }).isValid, false);
    assert.strictEqual(
      validateCreateSecretInput({ ciphertext: "   ", iv: "some_iv" }).isValid,
      false
    );
  });

  it("should reject invalid Base64URL characters in ciphertext", () => {
    const result = validateCreateSecretInput({
      ciphertext: "invalid+ciphertext/with=padding!",
      iv: "valid_iv",
    });
    assert.strictEqual(result.isValid, false);
    assert.match(result.error ?? "", /Base64URL/);
  });

  it("should reject oversized ciphertext (> 1MB)", () => {
    const hugeCiphertext = "A".repeat(1_048_577);
    const result = validateCreateSecretInput({
      ciphertext: hugeCiphertext,
      iv: "valid_iv",
    });
    assert.strictEqual(result.isValid, false);
    assert.match(result.error ?? "", /maximum allowed length/);
  });

  it("should reject invalid expiresIn ranges", () => {
    // Too short (< 60s)
    const tooShort = validateCreateSecretInput({
      ciphertext: "valid_text",
      iv: "valid_iv",
      expiresIn: 30,
    });
    assert.strictEqual(tooShort.isValid, false);

    // Too long (> 7 days)
    const tooLong = validateCreateSecretInput({
      ciphertext: "valid_text",
      iv: "valid_iv",
      expiresIn: 604_801,
    });
    assert.strictEqual(tooLong.isValid, false);

    // Non-integer
    const nonInt = validateCreateSecretInput({
      ciphertext: "valid_text",
      iv: "valid_iv",
      expiresIn: 123.45,
    });
    assert.strictEqual(nonInt.isValid, false);
  });

  it("should reject invalid maxViews ranges", () => {
    const zeroViews = validateCreateSecretInput({
      ciphertext: "valid_text",
      iv: "valid_iv",
      maxViews: 0,
    });
    assert.strictEqual(zeroViews.isValid, false);

    const tooManyViews = validateCreateSecretInput({
      ciphertext: "valid_text",
      iv: "valid_iv",
      maxViews: 101,
    });
    assert.strictEqual(tooManyViews.isValid, false);
  });

  it("should validate secret ID format correctly", () => {
    assert.strictEqual(validateSecretId("abcDEF123456_--xyz").isValid, true);
    assert.strictEqual(validateSecretId("short").isValid, false); // < 16 chars
    assert.strictEqual(validateSecretId("invalid@characters!#$").isValid, false);
    assert.strictEqual(validateSecretId(12345).isValid, false);
  });
});
