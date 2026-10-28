import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, verifyToken } from "@/lib/access";

// Guides stay public (they're meant to be shared); only the live agent, which
// spends sandbox time and model usage, is gated.
export async function proxy(req: NextRequest) {
  if (await verifyToken(req.cookies.get(COOKIE)?.value)) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Access code required" }, { status: 401 });
  }
  const url = new URL("/unlock", req.url);
  url.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/generate", "/api/runs/:path*"],
};
