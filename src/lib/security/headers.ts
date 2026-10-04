/**
 * Security Headers Configuration and Helpers for SecretDrop
 * Enforces strict CSP, HSTS, anti-framing, no-referrer, and ephemeral caching policies.
 */

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-eval permitted for dev/hydration, restricted in prod
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

export const SECURITY_HEADERS: Record<string, string> = {
  // Prevent MIME type sniffing
  "X-Content-Type-Options": "nosniff",

  // Prevent clickjacking / frame embedding
  "X-Frame-Options": "DENY",

  // Ensure secrets and URL hash fragments are never leaked in Referer headers
  "Referrer-Policy": "no-referrer",

  // Modern HSTS (2 years, subdomains, preloaded)
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",

  // Strict Content Security Policy
  "Content-Security-Policy": CONTENT_SECURITY_POLICY,

  // Disable sensitive hardware/browser permissions
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), browsing-topics=(), payment=(), usb=(), display-capture=()",

  // Modern replacement for deprecated X-XSS-Protection
  "X-XSS-Protection": "0",

  // Process isolation & cross-origin protections
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
};

/**
 * Ephemeral Cache-Control Headers for Secret Payloads
 * Ensures intermediate proxies, CDNs, and browsers never cache decrypted or encrypted secrets.
 */
export const EPHEMERAL_CACHE_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  "Pragma": "no-cache",
  "Expires": "0",
  "Surrogate-Control": "no-store",
};

/**
 * Applies security and cache headers to a Response object
 */
export function applySecurityHeaders(
  response: Response,
  extraHeaders?: Record<string, string>
): Response {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }

  if (extraHeaders) {
    for (const [key, value] of Object.entries(extraHeaders)) {
      response.headers.set(key, value);
    }
  }

  return response;
}
