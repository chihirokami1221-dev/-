import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

// 追加パッケージを使わず、Node標準のcryptoだけで「自分専用アクセス制限」を実装する。
// パスワードは平文で保存せず、scryptでハッシュ化した値のみ.envに保存している。
// セッションはDBを使わず、HMAC署名付きCookie(有効期限+署名)で検証する(改ざん不可)。

export const SESSION_COOKIE_NAME = "growth_os_session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30日

// 認証用の環境変数が未設定・不正な場合に投げる専用エラー。
// 「パスワードが間違っている」等の通常の認証失敗と区別するために使う。
export class AuthConfigError extends Error {}

function getSecret(name: string): string {
  const value = process.env[name];
  if (!value) throw new AuthConfigError(`環境変数 ${name} が設定されていません。`);
  return value;
}

// 設定不備を検知した際、値を含まない形でサーバー側ログにのみ記録する。
function logAuthConfigError(context: string, error: unknown) {
  if (error instanceof AuthConfigError) {
    console.error(`[auth] 認証設定が不足しています(${context}): ${error.message}`);
  }
}

export function verifyPassword(input: string): boolean {
  const salt = getSecret("AUTH_PASSWORD_SALT");
  const expectedHash = getSecret("AUTH_PASSWORD_HASH");

  const inputHash = crypto.scryptSync(input, salt, 64);
  const expectedBuffer = Buffer.from(expectedHash, "hex");

  // 長さが違うとtimingSafeEqualが例外を投げるため、先に長さを合わせてから比較する。
  if (inputHash.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(inputHash, expectedBuffer);
}

function sign(payload: string): string {
  const secret = getSecret("AUTH_SESSION_SECRET");
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

// Cookie値 = "<有効期限のUnix時刻>.<署名>"。署名が一致しない限り、
// どんな値を送っても「ログイン済み」とは判定しない。
// 設定不備(AUTH_SESSION_SECRET未設定等)はログインAPI側で捕捉し区別するため、ここでは例外をそのまま投げる。
export function createSessionCookieValue(): string {
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const payload = String(expiresAt);
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function verifySessionCookieValue(value: string | undefined): boolean {
  if (!value) return false;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return false;

  // proxy.tsや各APIルートから直接呼ばれるため、設定不備時も例外を外に漏らさず
  // 「未認証」として扱う(fail-closed)。ログイン自体ができない状態になるため、
  // サーバー側ログにのみ記録して気づけるようにする。
  let expectedSignature: string;
  try {
    expectedSignature = sign(payload);
  } catch (error) {
    logAuthConfigError("verifySessionCookieValue", error);
    return false;
  }

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (sigBuffer.length !== expectedBuffer.length) return false;
  if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return false;

  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  return true;
}

// APIルート個別でも呼べる認証チェック(proxy.tsだけに依存しない二重防御)。
export function isAuthenticatedRequest(req: Request): boolean {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!match) return false;
  const value = decodeURIComponent(match.slice(SESSION_COOKIE_NAME.length + 1));
  return verifySessionCookieValue(value);
}

function sameHost(urlString: string, requestHost: string | null): boolean {
  if (!requestHost) return false;
  try {
    return new URL(urlString).host === requestHost;
  } catch {
    return false;
  }
}

// 更新系リクエストのCSRF対策: Originヘッダーが自分のサイトと一致するかを確認する。
// 通常のfetchによる同一オリジンの更新系リクエストはOriginヘッダーを送るため、
// Originが無い場合はRefererで代替判定し、どちらも無ければ安全側に倒して拒否する。
export function isSameOriginRequest(req: Request): boolean {
  const requestHost = req.headers.get("host");
  const origin = req.headers.get("origin");
  if (origin) {
    return sameHost(origin, requestHost);
  }
  const referer = req.headers.get("referer");
  if (referer) {
    return sameHost(referer, requestHost);
  }
  return false;
}

// --- ログイン試行回数制限(総当たり対策) ---
// サーバーレス環境(Vercel等)ではインスタンスごとのメモリ内カウンターが共有されないため、
// 代わりにクライアント側のHMAC署名付きCookieに「直近の失敗回数+ウィンドウ開始時刻」を
// 持たせる(DBやKVストアを新設しない、無料・既存の仕組みだけで動く方式)。
// 署名検証に落ちた/存在しない場合は「失敗0回」として扱う(fail-open)。これは意図した設計で、
// セッションCookieのような本来の認証境界ではなく、あくまで総当たりを遅くするための
// 軽い抑止策であるため。Cookieを消せば回避できる点は既知の限界として残る。
export const LOGIN_ATTEMPT_COOKIE_NAME = "growth_os_login_attempts";
const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15分
export const LOGIN_ATTEMPT_MAX = 5;

export interface LoginAttemptState {
  count: number;
  windowStart: number;
}

function freshAttemptState(): LoginAttemptState {
  return { count: 0, windowStart: Date.now() };
}

export function buildLoginAttemptCookieValue(state: LoginAttemptState): string {
  const payload = `${state.count}.${state.windowStart}`;
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function readLoginAttemptState(value: string | undefined): LoginAttemptState {
  if (!value) return freshAttemptState();
  const parts = value.split(".");
  if (parts.length !== 3) return freshAttemptState();
  const [countStr, windowStartStr, signature] = parts;
  const payload = `${countStr}.${windowStartStr}`;

  let expectedSignature: string;
  try {
    expectedSignature = sign(payload);
  } catch (error) {
    logAuthConfigError("readLoginAttemptState", error);
    return freshAttemptState();
  }

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return freshAttemptState();
  }

  const count = Number(countStr);
  const windowStart = Number(windowStartStr);
  if (!Number.isFinite(count) || !Number.isFinite(windowStart)) return freshAttemptState();

  // ウィンドウ期間を過ぎていれば、新しいウィンドウとして数え直す。
  if (Date.now() - windowStart > LOGIN_ATTEMPT_WINDOW_MS) return freshAttemptState();

  return { count, windowStart };
}

export function isLoginRateLimited(state: LoginAttemptState): boolean {
  return state.count >= LOGIN_ATTEMPT_MAX;
}

export function recordFailedLoginAttempt(state: LoginAttemptState): LoginAttemptState {
  // ウィンドウが切れていれば、失敗1回目として新しいウィンドウを開始する。
  if (Date.now() - state.windowStart > LOGIN_ATTEMPT_WINDOW_MS) {
    return { count: 1, windowStart: Date.now() };
  }
  return { count: state.count + 1, windowStart: state.windowStart };
}

// APIルート先頭で呼ぶだけで済む共通ガード。未認証なら401レスポンスを返し、呼び出し側はそれをreturnする。
export function requireAuth(req: NextRequest): NextResponse | null {
  if (isAuthenticatedRequest(req)) return null;
  return NextResponse.json({ error: "認証が必要です。" }, { status: 401 });
}

// APIルート先頭で呼ぶだけで済む共通CSRFガード。Origin不一致なら403レスポンスを返す。
export function requireSameOrigin(req: NextRequest): NextResponse | null {
  if (isSameOriginRequest(req)) return null;
  return NextResponse.json({ error: "不正なリクエストです。" }, { status: 403 });
}
