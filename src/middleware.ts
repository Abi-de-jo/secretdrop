import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SECURITY_HEADERS, EPHEMERAL_CACHE_HEADERS } from "@/lib/security/headers";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Apply default security headers
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }

  // If request is to /api/secrets, ensure no-cache headers are set
  if (request.nextUrl.pathname.startsWith("/api/secrets")) {
    for (const [key, value] of Object.entries(EPHEMERAL_CACHE_HEADERS)) {
      response.headers.set(key, value);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
