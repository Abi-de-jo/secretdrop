/**
 * Sliding Window In-Memory Rate Limiter for Next.js API Routes & Middleware
 * Protects against brute-force attacks, secret scraping, and denial-of-service.
 */

import type { RateLimitResult } from "../crypto/types";

export interface RateLimiterOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum allowed requests in the window
  cleanupIntervalMs?: number; // Cleanup interval for stale IPs
}

interface WindowBucket {
  timestamps: number[];
}

export class RateLimiter {
  private hits = new Map<string, WindowBucket>();
  private windowMs: number;
  private maxRequests: number;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(options: RateLimiterOptions) {
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;

    const cleanupInterval = options.cleanupIntervalMs ?? Math.max(60_000, options.windowMs);
    if (typeof setInterval !== "undefined") {
      this.cleanupTimer = setInterval(() => {
        this.cleanup();
      }, cleanupInterval);
      if (this.cleanupTimer && typeof this.cleanupTimer === "object" && "unref" in this.cleanupTimer) {
        this.cleanupTimer.unref();
      }
    }
  }

  /**
   * Evaluates if a request from the given identifier is within rate limits.
   */
  public check(identifier: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    let bucket = this.hits.get(identifier);
    if (!bucket) {
      bucket = { timestamps: [] };
      this.hits.set(identifier, bucket);
    }

    // Filter out timestamps outside the sliding window
    bucket.timestamps = bucket.timestamps.filter((ts) => ts > windowStart);

    const currentCount = bucket.timestamps.length;
    const remaining = Math.max(0, this.maxRequests - currentCount - 1);
    const oldestTimestamp = bucket.timestamps[0] ?? now;
    const resetTime = Math.ceil((oldestTimestamp + this.windowMs - now) / 1000);
    const retryAfter = Math.max(1, resetTime);

    if (currentCount >= this.maxRequests) {
      return {
        success: false,
        limit: this.maxRequests,
        remaining: 0,
        reset: resetTime,
        retryAfter,
      };
    }

    // Record this hit
    bucket.timestamps.push(now);

    return {
      success: true,
      limit: this.maxRequests,
      remaining,
      reset: resetTime,
      retryAfter: 0,
    };
  }

  /**
   * Cleans up stale rate limit entries
   */
  public cleanup(): number {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    let purged = 0;

    for (const [key, bucket] of this.hits) {
      bucket.timestamps = bucket.timestamps.filter((ts) => ts > windowStart);
      if (bucket.timestamps.length === 0) {
        this.hits.delete(key);
        purged++;
      }
    }

    return purged;
  }

  /**
   * Resets rate limits for an identifier or all
   */
  public reset(identifier?: string): void {
    if (identifier) {
      this.hits.delete(identifier);
    } else {
      this.hits.clear();
    }
  }

  /**
   * Stops cleanup timer
   */
  public stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

/**
 * Extracts client IP safely from Request headers
 */
export function getClientIp(request: Request): string {
  const headers = request.headers;

  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0].trim();
    if (firstIp) return firstIp;
  }

  const realIp = headers.get("x-real-ip");
  if (realIp && realIp.trim()) return realIp.trim();

  const cfConnectingIp = headers.get("cf-connecting-ip");
  if (cfConnectingIp && cfConnectingIp.trim()) return cfConnectingIp.trim();

  return "127.0.0.1";
}

/**
 * Creates standard rate-limit headers to attach to Response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": result.reset.toString(),
  };

  if (!result.success) {
    headers["Retry-After"] = result.retryAfter.toString();
  }

  return headers;
}

// Global preconfigured rate limiters
export const createSecretLimiter = new RateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  maxRequests: 30, // 30 creations per 10 minutes per IP
});

export const readSecretLimiter = new RateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  maxRequests: 100, // 100 reads per 10 minutes per IP
});
