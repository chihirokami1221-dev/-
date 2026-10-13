import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, requireSameOrigin } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const csrfError = requireSameOrigin(req);
  if (csrfError) return csrfError;

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
