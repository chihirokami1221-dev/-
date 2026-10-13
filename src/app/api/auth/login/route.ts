import { NextRequest, NextResponse } from "next/server";
import {
  verifyPassword,
  createSessionCookieValue,
  SESSION_COOKIE_NAME,
  isSameOriginRequest,
  AuthConfigError,
  LOGIN_ATTEMPT_COOKIE_NAME,
  readLoginAttemptState,
  isLoginRateLimited,
  recordFailedLoginAttempt,
  buildLoginAttemptCookieValue,
} from "@/lib/auth";

const LOGIN_ATTEMPT_COOKIE_MAX_AGE = 60 * 60; // 1時間(判定ウィンドウの15分より十分長く保持する)

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "不正なリクエストです。" }, { status: 403 });
  }

  const attemptState = readLoginAttemptState(req.cookies.get(LOGIN_ATTEMPT_COOKIE_NAME)?.value);
  if (isLoginRateLimited(attemptState)) {
    // パスワードの検証自体を行わない(正誤の情報を一切与えない)。
    return NextResponse.json(
      { error: "試行回数が多すぎます。しばらく時間を置いてから再試行してください。" },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";

  // 失敗時は理由を詳しく返さない(総当たり攻撃のヒントを与えないため)。
  if (!password) {
    return NextResponse.json({ error: "パスワードが正しくありません。" }, { status: 401 });
  }

  let res: NextResponse;
  try {
    if (!verifyPassword(password)) {
      const nextState = recordFailedLoginAttempt(attemptState);
      res = NextResponse.json({ error: "パスワードが正しくありません。" }, { status: 401 });
      res.cookies.set(LOGIN_ATTEMPT_COOKIE_NAME, buildLoginAttemptCookieValue(nextState), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: LOGIN_ATTEMPT_COOKIE_MAX_AGE,
      });
      return res;
    }

    res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE_NAME, createSessionCookieValue(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    // ログイン成功時は、これまでの失敗回数をリセットする。
    res.cookies.delete(LOGIN_ATTEMPT_COOKIE_NAME);
  } catch (error) {
    // AUTH_PASSWORD_SALT/HASH/AUTH_SESSION_SECRET未設定時は、通常のパスワード誤りと混同させない。
    if (error instanceof AuthConfigError) {
      console.error("[auth] ログインAPI: 認証設定が不足しています。", error.message);
      return NextResponse.json({ error: "サーバー設定エラーが発生しました。" }, { status: 500 });
    }
    throw error;
  }

  return res;
}
