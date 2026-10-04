/**
 * Zero-Knowledge Client-Side Web Crypto Implementation
 * Uses AES-256-GCM and PBKDF2 (SHA-256, 100,000 iterations)
 * Isomorphic: works seamlessly in Browser, Next.js Edge, and Node.js runtimes.
 */

import type {
  EncryptedPayload,
  EncryptionOptions,
  DecryptionOptions,
} from "./types";

const AES_ALGORITHM = "AES-GCM";
const AES_KEY_LENGTH = 256;
const IV_LENGTH_BYTES = 12; // 96 bits for AES-GCM
const SALT_LENGTH_BYTES = 16; // 128 bits for PBKDF2
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_HASH = "SHA-256";

/** Custom Error thrown when decryption fails */
export class DecryptionError extends Error {
  constructor(message = "Decryption failed: invalid key, wrong passphrase, or tampered payload") {
    super(message);
    this.name = "DecryptionError";
  }
}

/** Get the Web Crypto API instance */
function getCrypto(): Crypto {
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.subtle) {
    return globalThis.crypto;
  }
  throw new Error("Web Crypto API (crypto.subtle) is not available in this environment.");
}

/* ==========================================================================
   Base64URL Utility Functions (RFC 4648 § 5)
   ========================================================================== */

/** Converts Uint8Array to URL-safe Base64 string */
export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = typeof btoa === "function" ? btoa(binary) : Buffer.from(bytes).toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Converts URL-safe Base64 string to Uint8Array */
export function base64UrlToBytes(base64Url: string): Uint8Array {
  // Restore standard Base64 characters and padding
  let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }

  if (typeof atob === "function") {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  return new Uint8Array(Buffer.from(base64, "base64"));
}

/** Generates cryptographically secure random bytes */
export function getRandomBytes(length: number): Uint8Array {
  const crypto = getCrypto();
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

/** Generates a cryptographically secure random secret ID */
export function generateSecretId(byteLength = 16): string {
  return bytesToBase64Url(getRandomBytes(byteLength));
}

/* ==========================================================================
   Key Generation, Import, and Export
   ========================================================================== */

/** Generates a fresh random 256-bit AES-GCM CryptoKey */
export async function generateAesKey(extractable = true): Promise<CryptoKey> {
  const crypto = getCrypto();
  return await crypto.subtle.generateKey(
    {
      name: AES_ALGORITHM,
      length: AES_KEY_LENGTH,
    },
    extractable,
    ["encrypt", "decrypt"]
  );
}

/** Exports a CryptoKey to Base64URL string */
export async function exportKeyToBase64Url(key: CryptoKey): Promise<string> {
  const crypto = getCrypto();
  const raw = await crypto.subtle.exportKey("raw", key);
  return bytesToBase64Url(new Uint8Array(raw));
}

/** Imports an AES-GCM CryptoKey from Base64URL string */
export async function importKeyFromBase64Url(base64UrlKey: string, extractable = false): Promise<CryptoKey> {
  const crypto = getCrypto();
  const keyBytes = base64UrlToBytes(base64UrlKey);
  return await crypto.subtle.importKey(
    "raw",
    keyBytes as BufferSource,
    {
      name: AES_ALGORITHM,
      length: AES_KEY_LENGTH,
    },
    extractable,
    ["encrypt", "decrypt"]
  );
}

/** Derives an AES-256-GCM CryptoKey from a user passphrase and salt via PBKDF2 */
export async function deriveKeyFromPassphrase(
  passphrase: string,
  saltBytes: Uint8Array,
  extractable = false
): Promise<CryptoKey> {
  const crypto = getCrypto();
  const encoder = new TextEncoder();
  const passphraseBytes = encoder.encode(passphrase);

  // Import passphrase as key material for PBKDF2
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    passphraseBytes,
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  // Derive AES-GCM 256-bit key
  return await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: PBKDF2_HASH,
    },
    keyMaterial,
    {
      name: AES_ALGORITHM,
      length: AES_KEY_LENGTH,
    },
    extractable,
    ["encrypt", "decrypt"]
  );
}

/* ==========================================================================
   Encryption & Decryption
   ========================================================================== */

/**
 * Encrypts a plaintext string with AES-256-GCM.
 * If passphrase is provided, derives key via PBKDF2.
 * If key is provided, uses it.
 * Otherwise, generates a fresh random key and returns its Base64URL representation.
 */
export async function encryptSecret(
  plaintext: string,
  options: EncryptionOptions = {}
): Promise<EncryptedPayload> {
  const crypto = getCrypto();
  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(plaintext);

  // Generate 12-byte IV for AES-GCM
  const ivBytes = getRandomBytes(IV_LENGTH_BYTES);
  const ivBase64 = bytesToBase64Url(ivBytes);

  let cryptoKey: CryptoKey;
  let exportedKey: string | undefined;
  let saltBase64: string | undefined;

  if (options.passphrase && options.passphrase.trim().length > 0) {
    // Passphrase-based encryption
    const saltBytes = getRandomBytes(SALT_LENGTH_BYTES);
    saltBase64 = bytesToBase64Url(saltBytes);
    cryptoKey = await deriveKeyFromPassphrase(options.passphrase, saltBytes);
  } else if (options.key) {
    // Existing key provided
    if (typeof options.key === "string") {
      cryptoKey = await importKeyFromBase64Url(options.key);
      exportedKey = options.key;
    } else {
      cryptoKey = options.key;
      if (cryptoKey.extractable) {
        exportedKey = await exportKeyToBase64Url(cryptoKey);
      }
    }
  } else {
    // Generate fresh random key
    cryptoKey = await generateAesKey(true);
    exportedKey = await exportKeyToBase64Url(cryptoKey);
  }

  // Encrypt plaintext with AES-GCM (authenticated tag automatically appended to ciphertext buffer)
  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: AES_ALGORITHM,
      iv: ivBytes as BufferSource,
    },
    cryptoKey,
    plaintextBytes
  );

  const ciphertextBase64 = bytesToBase64Url(new Uint8Array(ciphertextBuffer));

  return {
    ciphertext: ciphertextBase64,
    iv: ivBase64,
    salt: saltBase64,
    key: exportedKey,
  };
}

/**
 * Decrypts an AES-256-GCM encrypted payload.
 * Requires either an exported Base64URL key or a passphrase + salt.
 */
export async function decryptSecret(
  ciphertext: string,
  iv: string,
  keyOrPassphrase: string,
  options: DecryptionOptions = {}
): Promise<string> {
  const crypto = getCrypto();

  try {
    const ciphertextBytes = base64UrlToBytes(ciphertext);
    const ivBytes = base64UrlToBytes(iv);

    let cryptoKey: CryptoKey;

    if (options.salt || options.passphrase) {
      const passphrase = options.passphrase || keyOrPassphrase;
      const saltStr = options.salt;
      if (!saltStr) {
        throw new DecryptionError("Salt is required for passphrase-protected secret decryption");
      }
      const saltBytes = base64UrlToBytes(saltStr);
      cryptoKey = await deriveKeyFromPassphrase(passphrase, saltBytes);
    } else {
      cryptoKey = await importKeyFromBase64Url(keyOrPassphrase);
    }

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: AES_ALGORITHM,
        iv: ivBytes as BufferSource,
      },
      cryptoKey,
      ciphertextBytes as BufferSource
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (err: unknown) {
    if (err instanceof DecryptionError) {
      throw err;
    }
    throw new DecryptionError("Failed to decrypt secret: invalid key, wrong passphrase, or tampered payload");
  }
}

/* ==========================================================================
   Zero-Knowledge URL Helpers
   ========================================================================== */

/**
 * Creates a zero-knowledge shareable URL.
 * The encryption key is placed in the URL hash fragment (#...) so it is NEVER sent to the server.
 */
export function createSecretShareUrl(origin: string, secretId: string, key: string): string {
  const cleanOrigin = origin.replace(/\/+$/, "");
  return `${cleanOrigin}/secret/${secretId}#${key}`;
}

/**
 * Parses secret ID and key from a URL or hash fragment.
 */
export function parseSecretShareUrl(urlOrHash: string): { id?: string; key?: string } {
  try {
    if (urlOrHash.startsWith("#")) {
      return { key: urlOrHash.substring(1) };
    }

    if (urlOrHash.includes("#")) {
      const [urlPart, hashPart] = urlOrHash.split("#");
      const url = new URL(urlPart.startsWith("http") ? urlPart : `https://dummy.local${urlPart.startsWith("/") ? "" : "/"}${urlPart}`);
      const segments = url.pathname.split("/").filter(Boolean);
      const id = segments[segments.length - 1];
      return { id, key: hashPart };
    }

    return {};
  } catch {
    return {};
  }
}
