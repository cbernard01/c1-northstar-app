import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";

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
    "/settings/:path*",
    "/admin/:path*",
  ],
};