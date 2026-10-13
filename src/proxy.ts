import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from "@/lib/auth";

// Next.js 16の正式な保護機構(旧middleware.tsはNext.js 16で非推奨)。
// ページ・API問わず、ここを通る全リクエストを一括でチェックする「第一の壁」。
// 個別APIルート側にもrequireAuth的なチェックを入れる場合はsrc/lib/auth.tsのisAuthenticatedRequestを使う(第二の壁)。
export function proxy(req: NextRequest) {
  const sessionValue = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const authenticated = verifySessionCookieValue(sessionValue);

  if (authenticated) {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "認証が必要です。" }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // ログイン画面・ログインAPI・Next.js内部ファイル・PWA用の公開ファイルは保護対象から除外する。
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons|login|api/auth).*)"],
};
