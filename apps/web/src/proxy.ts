import { type NextRequest, NextResponse } from "next/server";

import { DEMO_COOKIE, DEMO_USER_ID } from "@/lib/demo-session";

// Mock auth gate: without the demo cookie, every page redirects to /signin.
export function proxy(request: NextRequest) {
  if (request.cookies.get(DEMO_COOKIE)?.value === DEMO_USER_ID) return NextResponse.next();
  return NextResponse.redirect(new URL("/signin", request.url));
}

export const config = {
  matcher: [
    // Everything except sign-in, API routes, Next internals, and public PWA assets.
    "/((?!signin|pitch/|api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.png$).*)",
  ],
};
