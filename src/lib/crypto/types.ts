/**
 * Cryptographic and SecretDrop Type Definitions
 */

export interface EncryptedPayload {
  /** Base64URL-encoded ciphertext with appended GCM authentication tag */
  ciphertext: string;
  /** Base64URL-encoded 96-bit (12-byte) initialization vector */
  iv: string;
  /** Base64URL-encoded salt if passphrase derivation was used */
  salt?: string;
  /** Exported Base64URL-encoded AES key (if generated client-side for URL hash) */
  key?: string;
}

export interface EncryptionOptions {
  /** Existing CryptoKey or exported Base64URL key */
  key?: CryptoKey | string;
  /** Optional user passphrase for dual-factor or password-protected secrets */
  passphrase?: string;
}

export interface DecryptionOptions {
  /** Optional user passphrase if secret was protected with passphrase */
  passphrase?: string;
  /** Base64URL salt if passphrase was used */
  salt?: string;
}

export interface SecretMetadata {
  id: string;
  createdAt: number;
  expiresAt: number;
  maxViews: number;
  remainingViews: number;
  burnAfterRead: boolean;
  isBurned: boolean;
  burnedAt?: number;
}

export interface StoredSecretRecord extends SecretMetadata {
  ciphertext: string;
  iv: string;
  salt?: string;
}

export interface CreateSecretInput {
  ciphertext: string;
  iv: string;
  salt?: string;
  burnAfterRead?: boolean;
  expiresIn?: number; // seconds
  maxViews?: number;
}

export interface CreateSecretResponse {
  id: string;
  expiresAt: string; // ISO 8601 string
  maxViews: number;
  burnAfterRead: boolean;
}

export interface ConsumedSecretResponse {
  ciphertext: string;
  iv: string;
  salt?: string;
  burnAfterRead: boolean;
  remainingViews: number;
  expiresAt: string;
  isBurned: boolean;
}

export interface SecretMetaResponse {
  id: string;
  expiresAt: string;
  maxViews: number;
  remainingViews: number;
  burnAfterRead: boolean;
  isBurned: boolean;
  isExpired: boolean;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter: number;
}
