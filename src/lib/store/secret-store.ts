/**
 * In-Memory Zero-Knowledge Secret Store & Data Lifecycle Policy Engine
 * Implements atomic consumption, time-to-live expiration, and automatic memory scrubbing.
 */

import { generateSecretId } from "../crypto/web-crypto";
import type {
  StoredSecretRecord,
  CreateSecretInput,
  ConsumedSecretResponse,
  SecretMetaResponse,
} from "../crypto/types";

export interface ISecretStore {
  createSecret(input: CreateSecretInput): Promise<StoredSecretRecord>;
  getAndConsumeSecret(id: string): Promise<ConsumedSecretResponse | null>;
  getSecretMeta(id: string): Promise<SecretMetaResponse | null>;
  deleteSecret(id: string): Promise<boolean>;
  cleanupExpiredSecrets(): number;
  getStats(): { activeSecrets: number; totalCreated: number; totalBurned: number };
  clear(): void;
}

export interface SecretStoreConfig {
  maxCapacity?: number;
  defaultTtlSeconds?: number;
  maxTtlSeconds?: number;
  minTtlSeconds?: number;
  cleanupIntervalMs?: number;
}

const DEFAULT_CONFIG: Required<SecretStoreConfig> = {
  maxCapacity: 50_000,
  defaultTtlSeconds: 86_400, // 24 hours
  maxTtlSeconds: 604_800, // 7 days
  minTtlSeconds: 60, // 1 minute
  cleanupIntervalMs: 60_000, // 1 minute sweep
};

export class MemorySecretStore implements ISecretStore {
  private secrets = new Map<string, StoredSecretRecord>();
  private totalCreated = 0;
  private totalBurned = 0;
  private config: Required<SecretStoreConfig>;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config?: SecretStoreConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startPeriodicCleanup();
  }

  /**
   * Starts periodic garbage collection timer for expired secrets
   */
  private startPeriodicCleanup(): void {
    if (typeof setInterval !== "undefined") {
      this.cleanupTimer = setInterval(() => {
        this.cleanupExpiredSecrets();
      }, this.config.cleanupIntervalMs);
      if (this.cleanupTimer && typeof this.cleanupTimer === "object" && "unref" in this.cleanupTimer) {
        this.cleanupTimer.unref();
      }
    }
  }

  /**
   * Stops periodic cleanup timer
   */
  public stopPeriodicCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Enforces capacity limits to prevent memory exhaustion DoS
   */
  private ensureCapacity(): void {
    if (this.secrets.size >= this.config.maxCapacity) {
      // First clean up expired
      this.cleanupExpiredSecrets();

      // If still at capacity, evict oldest entries
      if (this.secrets.size >= this.config.maxCapacity) {
        let countToEvict = Math.ceil(this.config.maxCapacity * 0.1); // Evict 10%
        for (const [id] of this.secrets) {
          if (countToEvict <= 0) break;
          this.secrets.delete(id);
          countToEvict--;
        }
      }
    }
  }

  /**
   * Creates and stores a new encrypted secret payload with lifecycle constraints
   */
  public async createSecret(input: CreateSecretInput): Promise<StoredSecretRecord> {
    this.ensureCapacity();

    const now = Date.now();
    let ttlSeconds = input.expiresIn ?? this.config.defaultTtlSeconds;

    if (ttlSeconds < this.config.minTtlSeconds) {
      ttlSeconds = this.config.minTtlSeconds;
    } else if (ttlSeconds > this.config.maxTtlSeconds) {
      ttlSeconds = this.config.maxTtlSeconds;
    }

    const expiresAt = now + ttlSeconds * 1000;
    const maxViews = Math.max(1, Math.min(input.maxViews ?? 1, 100));
    const burnAfterRead = input.burnAfterRead ?? true;
    const id = generateSecretId(24);

    const record: StoredSecretRecord = {
      id,
      ciphertext: input.ciphertext,
      iv: input.iv,
      salt: input.salt,
      createdAt: now,
      expiresAt,
      maxViews,
      remainingViews: maxViews,
      burnAfterRead,
      isBurned: false,
    };

    this.secrets.set(id, record);
    this.totalCreated++;

    return record;
  }

  /**
   * Atomically retrieves and consumes/burns a secret.
   * If burnAfterRead is true or max views reached, the secret is permanently wiped.
   */
  public async getAndConsumeSecret(id: string): Promise<ConsumedSecretResponse | null> {
    const record = this.secrets.get(id);
    if (!record) {
      return null;
    }

    const now = Date.now();

    // Check expiration
    if (now > record.expiresAt) {
      this.secrets.delete(id);
      return null;
    }

    // Check already burned
    if (record.isBurned || record.remainingViews <= 0) {
      this.secrets.delete(id);
      return null;
    }

    // Decrement view count
    record.remainingViews -= 1;
    const shouldBurn = record.burnAfterRead || record.remainingViews <= 0;

    const response: ConsumedSecretResponse = {
      ciphertext: record.ciphertext,
      iv: record.iv,
      salt: record.salt,
      burnAfterRead: record.burnAfterRead,
      remainingViews: Math.max(0, record.remainingViews),
      expiresAt: new Date(record.expiresAt).toISOString(),
      isBurned: shouldBurn,
    };

    if (shouldBurn) {
      record.isBurned = true;
      record.burnedAt = now;
      this.totalBurned++;
      // Immediately purge ciphertext and remove from store
      this.secrets.delete(id);
    }

    return response;
  }

  /**
   * Retrieves secret metadata without consuming or burning it
   */
  public async getSecretMeta(id: string): Promise<SecretMetaResponse | null> {
    const record = this.secrets.get(id);
    if (!record) {
      return null;
    }

    const now = Date.now();
    const isExpired = now > record.expiresAt;

    if (isExpired) {
      this.secrets.delete(id);
      return null;
    }

    return {
      id: record.id,
      expiresAt: new Date(record.expiresAt).toISOString(),
      maxViews: record.maxViews,
      remainingViews: record.remainingViews,
      burnAfterRead: record.burnAfterRead,
      isBurned: record.isBurned,
      isExpired: false,
      hasPassphrase: Boolean(record.salt),
    };
  }

  /**
   * Manually burns/deletes a secret immediately
   */
  public async deleteSecret(id: string): Promise<boolean> {
    const existed = this.secrets.delete(id);
    if (existed) {
      this.totalBurned++;
    }
    return existed;
  }

  /**
   * Sweeps memory and removes expired secrets
   */
  public cleanupExpiredSecrets(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, record] of this.secrets) {
      if (now > record.expiresAt) {
        this.secrets.delete(id);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Returns current statistics for monitoring
   */
  public getStats(): { activeSecrets: number; totalCreated: number; totalBurned: number } {
    return {
      activeSecrets: this.secrets.size,
      totalCreated: this.totalCreated,
      totalBurned: this.totalBurned,
    };
  }

  /**
   * Clears the entire store (for test resets)
   */
  public clear(): void {
    this.secrets.clear();
    this.totalCreated = 0;
    this.totalBurned = 0;
  }
}

// Global Singleton Instance across hot-reloads in Next.js development
const globalForSecretStore = globalThis as unknown as {
  secretStoreInstance?: MemorySecretStore;
};

export const secretStore: ISecretStore =
  globalForSecretStore.secretStoreInstance ??
  (globalForSecretStore.secretStoreInstance = new MemorySecretStore());
