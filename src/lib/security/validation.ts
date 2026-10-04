/**
 * Input Validation and Sanitization for SecretDrop APIs
 * Protects against oversized payloads, injection attacks, and malformed requests.
 */

import type { CreateSecretInput } from "../crypto/types";

const MAX_CIPHERTEXT_LENGTH = 1_048_576; // 1 MB ciphertext max
const BASE64_URL_REGEX = /^[A-Za-z0-9_-]+$/;
const SECRET_ID_REGEX = /^[A-Za-z0-9_-]{16,64}$/;

export interface ValidationResult<T> {
  isValid: boolean;
  data?: T;
  error?: string;
}

/**
 * Validates and sanitizes payload for secret creation
 */
export function validateCreateSecretInput(body: unknown): ValidationResult<CreateSecretInput> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { isValid: false, error: "Invalid request payload: must be a JSON object" };
  }

  const payload = body as Record<string, unknown>;

  // Validate ciphertext
  if (typeof payload.ciphertext !== "string" || payload.ciphertext.trim().length === 0) {
    return { isValid: false, error: "Missing or invalid 'ciphertext' field: must be a non-empty string" };
  }

  const ciphertext = payload.ciphertext.trim();
  if (ciphertext.length > MAX_CIPHERTEXT_LENGTH) {
    return { isValid: false, error: `Ciphertext exceeds maximum allowed length of ${MAX_CIPHERTEXT_LENGTH} characters (1MB)` };
  }

  if (!BASE64_URL_REGEX.test(ciphertext)) {
    return { isValid: false, error: "Invalid 'ciphertext' encoding: must be valid Base64URL" };
  }

  // Validate IV
  if (typeof payload.iv !== "string" || payload.iv.trim().length === 0) {
    return { isValid: false, error: "Missing or invalid 'iv' field: must be a non-empty Base64URL string" };
  }

  const iv = payload.iv.trim();
  if (iv.length > 64 || !BASE64_URL_REGEX.test(iv)) {
    return { isValid: false, error: "Invalid 'iv' field: must be valid Base64URL (12-byte IV)" };
  }

  // Validate optional salt
  let salt: string | undefined;
  if (payload.salt !== undefined && payload.salt !== null) {
    if (typeof payload.salt !== "string" || payload.salt.trim().length === 0) {
      return { isValid: false, error: "Invalid 'salt' field: must be a non-empty Base64URL string if provided" };
    }
    salt = payload.salt.trim();
    if (salt.length > 64 || !BASE64_URL_REGEX.test(salt)) {
      return { isValid: false, error: "Invalid 'salt' field: must be valid Base64URL (16-byte salt)" };
    }
  }

  // Validate optional burnAfterRead
  let burnAfterRead = true;
  if (payload.burnAfterRead !== undefined && payload.burnAfterRead !== null) {
    if (typeof payload.burnAfterRead !== "boolean") {
      return { isValid: false, error: "Invalid 'burnAfterRead' field: must be a boolean" };
    }
    burnAfterRead = payload.burnAfterRead;
  }

  // Validate optional expiresIn
  let expiresIn: number | undefined;
  if (payload.expiresIn !== undefined && payload.expiresIn !== null) {
    if (typeof payload.expiresIn !== "number" || !Number.isInteger(payload.expiresIn)) {
      return { isValid: false, error: "Invalid 'expiresIn' field: must be an integer (seconds)" };
    }
    if (payload.expiresIn < 60 || payload.expiresIn > 604_800) {
      return { isValid: false, error: "Invalid 'expiresIn' field: must be between 60 seconds (1 min) and 604800 seconds (7 days)" };
    }
    expiresIn = payload.expiresIn;
  }

  // Validate optional maxViews
  let maxViews: number | undefined;
  if (payload.maxViews !== undefined && payload.maxViews !== null) {
    if (typeof payload.maxViews !== "number" || !Number.isInteger(payload.maxViews)) {
      return { isValid: false, error: "Invalid 'maxViews' field: must be an integer" };
    }
    if (payload.maxViews < 1 || payload.maxViews > 100) {
      return { isValid: false, error: "Invalid 'maxViews' field: must be between 1 and 100" };
    }
    maxViews = payload.maxViews;
  }

  return {
    isValid: true,
    data: {
      ciphertext,
      iv,
      salt,
      burnAfterRead,
      expiresIn,
      maxViews,
    },
  };
}

/**
 * Validates secret ID format
 */
export function validateSecretId(id: unknown): ValidationResult<string> {
  if (typeof id !== "string" || !SECRET_ID_REGEX.test(id)) {
    return { isValid: false, error: "Invalid secret ID format" };
  }
  return { isValid: true, data: id };
}
