import { NextRequest, NextResponse } from "next/server";
import { verifyToken, TOKEN_COOKIE_NAME } from "@/lib/auth";

const PUBLIC_PATHS = ["/api/auth/login", "/api/auth/register", "/login"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    const headers = new Headers(request.headers);
    headers.delete("x-user-id");
    headers.delete("x-user-email");
    headers.delete("x-user-role");
    return NextResponse.next({ request: { headers } });
  }

  const token = request.cookies.get(TOKEN_COOKIE_NAME)?.value;

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const payload = await verifyToken(token);

    const headers = new Headers(request.headers);
    headers.set("x-user-id", payload.sub);
    headers.set("x-user-email", payload.email);
    headers.set("x-user-role", payload.role);

    return NextResponse.next({ request: { headers } });
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(TOKEN_COOKIE_NAME);
    return response;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
