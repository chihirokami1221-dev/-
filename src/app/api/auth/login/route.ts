import { NextRequest, NextResponse } from "next/server";
import {
  verifyPassword,
  createSessionCookieValue,
  SESSION_COOKIE_NAME,
  isSameOriginRequest,
  AuthConfigError,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "不正なリクエストです。" }, { status: 403 });
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
      return NextResponse.json({ error: "パスワードが正しくありません。" }, { status: 401 });
    }

    res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE_NAME, createSessionCookieValue(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
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
