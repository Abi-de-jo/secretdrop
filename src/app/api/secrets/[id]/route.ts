import { NextResponse } from "next/server";
import { secretStore } from "@/lib/store/secret-store";
import {
  readSecretLimiter,
  getClientIp,
  getRateLimitHeaders,
} from "@/lib/security/rate-limiter";
import { validateSecretId } from "@/lib/security/validation";
import {
  applySecurityHeaders,
  EPHEMERAL_CACHE_HEADERS,
} from "@/lib/security/headers";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/secrets/:id
 * Retrieves and atomically consumes/burns the encrypted secret payload.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;

  // 1. Rate Limiting Check
  const clientIp = getClientIp(request);
  const rateLimitResult = readSecretLimiter.check(clientIp);
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

  // 2. Validate Secret ID
  const idValidation = validateSecretId(id);
  if (!idValidation.isValid) {
    const notFoundResponse = NextResponse.json(
      { error: "Secret not found or has expired/been destroyed" },
      {
        status: 404,
        headers: {
          ...rateLimitHeaders,
          ...EPHEMERAL_CACHE_HEADERS,
        },
      }
    );
    return applySecurityHeaders(notFoundResponse);
  }

  // 3. Atomically Retrieve and Consume
  const consumedSecret = await secretStore.getAndConsumeSecret(id);

  if (!consumedSecret) {
    const notFoundResponse = NextResponse.json(
      { error: "Secret not found or has expired/been destroyed" },
      {
        status: 404,
        headers: {
          ...rateLimitHeaders,
          ...EPHEMERAL_CACHE_HEADERS,
        },
      }
    );
    return applySecurityHeaders(notFoundResponse);
  }

  const response = NextResponse.json(consumedSecret, {
    status: 200,
    headers: {
      ...rateLimitHeaders,
      ...EPHEMERAL_CACHE_HEADERS,
      "X-Secret-Burned": consumedSecret.isBurned ? "true" : "false",
    },
  });

  return applySecurityHeaders(response);
}

/**
 * DELETE /api/secrets/:id
 * Manually burns/destroys a secret immediately.
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const { id } = await params;

  const clientIp = getClientIp(request);
  const rateLimitResult = readSecretLimiter.check(clientIp);
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

  const idValidation = validateSecretId(id);
  if (!idValidation.isValid) {
    const notFoundResponse = NextResponse.json(
      { error: "Secret not found or already destroyed" },
      {
        status: 404,
        headers: {
          ...rateLimitHeaders,
          ...EPHEMERAL_CACHE_HEADERS,
        },
      }
    );
    return applySecurityHeaders(notFoundResponse);
  }

  const deleted = await secretStore.deleteSecret(id);

  if (!deleted) {
    const notFoundResponse = NextResponse.json(
      { error: "Secret not found or already destroyed" },
      {
        status: 404,
        headers: {
          ...rateLimitHeaders,
          ...EPHEMERAL_CACHE_HEADERS,
        },
      }
    );
    return applySecurityHeaders(notFoundResponse);
  }

  const response = NextResponse.json(
    { success: true, message: "Secret permanently destroyed" },
    {
      status: 200,
      headers: {
        ...rateLimitHeaders,
        ...EPHEMERAL_CACHE_HEADERS,
      },
    }
  );

  return applySecurityHeaders(response);
}
