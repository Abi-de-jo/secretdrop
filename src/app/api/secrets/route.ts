import { NextResponse } from "next/server";
import { secretStore } from "@/lib/store/secret-store";
import {
  createSecretLimiter,
  getClientIp,
  getRateLimitHeaders,
} from "@/lib/security/rate-limiter";
import { validateCreateSecretInput } from "@/lib/security/validation";
import {
  applySecurityHeaders,
  EPHEMERAL_CACHE_HEADERS,
} from "@/lib/security/headers";
import type { CreateSecretResponse } from "@/lib/crypto/types";

/**
 * POST /api/secrets
 * Stores a new zero-knowledge encrypted secret record.
 */
export async function POST(request: Request) {
  // 1. Rate Limiting Check
  const clientIp = getClientIp(request);
  const rateLimitResult = createSecretLimiter.check(clientIp);
  const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);

  if (!rateLimitResult.success) {
    const errorResponse = NextResponse.json(
      { error: "Too many requests. Rate limit exceeded. Please try again later." },
      {
        status: 429,
        headers: {
          ...rateLimitHeaders,
          ...EPHEMERAL_CACHE_HEADERS,
        },
      }
    );
    return applySecurityHeaders(errorResponse);
  }

  // 2. Parse and Validate Request Body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    const badJsonResponse = NextResponse.json(
      { error: "Invalid JSON in request body" },
      {
        status: 400,
        headers: {
          ...rateLimitHeaders,
          ...EPHEMERAL_CACHE_HEADERS,
        },
      }
    );
    return applySecurityHeaders(badJsonResponse);
  }

  const validation = validateCreateSecretInput(body);
  if (!validation.isValid || !validation.data) {
    const invalidResponse = NextResponse.json(
      { error: validation.error ?? "Invalid secret payload" },
      {
        status: 400,
        headers: {
          ...rateLimitHeaders,
          ...EPHEMERAL_CACHE_HEADERS,
        },
      }
    );
    return applySecurityHeaders(invalidResponse);
  }

  // 3. Store Secret with Lifecycle Policy
  try {
    const record = await secretStore.createSecret(validation.data);

    const responsePayload: CreateSecretResponse = {
      id: record.id,
      expiresAt: new Date(record.expiresAt).toISOString(),
      maxViews: record.maxViews,
      burnAfterRead: record.burnAfterRead,
    };

    const response = NextResponse.json(responsePayload, {
      status: 201,
      headers: {
        ...rateLimitHeaders,
        ...EPHEMERAL_CACHE_HEADERS,
      },
    });

    return applySecurityHeaders(response);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal server error";
    const serverErrorResponse = NextResponse.json(
      { error: "Failed to securely store secret: " + errorMsg },
      {
        status: 500,
        headers: {
          ...rateLimitHeaders,
          ...EPHEMERAL_CACHE_HEADERS,
        },
      }
    );
    return applySecurityHeaders(serverErrorResponse);
  }
}
