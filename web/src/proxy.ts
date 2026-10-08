import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const AUTH_PATHS = ["/login", "/forgot-password", "/reset-password"];
const PUBLIC_API_PATHS = ["/api/auth", "/api/health"];

function isAuthPath(pathname: string) {
  return AUTH_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = getSessionCookie(request);

  if (pathname.startsWith("/api/")) {
    // API callers expect JSON, not a redirect to the login page.
    const isPublic = PUBLIC_API_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    );
    if (!isPublic && !sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // A cookie can outlive its session (expiry, revocation), so only the auth layout — which
  // validates the session — may bounce signed-in users away from these pages.
  if (isAuthPath(pathname)) {
    return NextResponse.next();
  }

  if (!sessionCookie) {
    const login = new URL("/login", request.url);
    if (pathname !== "/") {
      login.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
