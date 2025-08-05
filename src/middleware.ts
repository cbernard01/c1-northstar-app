import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const session = await auth();

  if (!session) {
    const callbackUrl = encodeURIComponent(request.url);
    return NextResponse.redirect(new URL(`/signin?callbackUrl=${callbackUrl}`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/accounts/:path*",
    "/insights/:path*",
    "/jobs/:path*",
    "/upload/:path*",
    "/reports/:path*",
    "/chat/:path*",
    "/settings/:path*",
    "/admin/:path*",
  ],
};
