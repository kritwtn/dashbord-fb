import { NextResponse, type NextRequest } from "next/server";

// Cheap gate only (edge runtime can't run firebase-admin); pages & APIs verify the session cookie for real.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/login") || pathname.startsWith("/api/session") || pathname.startsWith("/api/cron"))
    return NextResponse.next();
  if (req.cookies.get("session")) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = { matcher: ["/((?!_next/|favicon.ico).*)"] };
