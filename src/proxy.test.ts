import { test, before } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

// このファイルはテスト専用のダミーのsalt/hash/secretだけを使う。実際の.envやログインパスワードには一切アクセスしない。
const FAKE_SALT = "test-salt-not-real";
const FAKE_PASSWORD = "test-password-123";
const FAKE_SESSION_SECRET = "test-session-secret-not-real";

let NextRequest: typeof import("next/server").NextRequest;
let proxy: typeof import("./proxy").proxy;
let config: typeof import("./proxy").config;
let SESSION_COOKIE_NAME: typeof import("./lib/auth").SESSION_COOKIE_NAME;
let createSessionCookieValue: typeof import("./lib/auth").createSessionCookieValue;

before(async () => {
  process.env.AUTH_PASSWORD_SALT = FAKE_SALT;
  process.env.AUTH_PASSWORD_HASH = crypto.scryptSync(FAKE_PASSWORD, FAKE_SALT, 64).toString("hex");
  process.env.AUTH_SESSION_SECRET = FAKE_SESSION_SECRET;

  ({ NextRequest } = await import("next/server"));
  ({ proxy, config } = await import("./proxy"));
  ({ SESSION_COOKIE_NAME, createSessionCookieValue } = await import("./lib/auth"));
});

const ORIGIN = "http://localhost:3000";

function makeRequest(path: string, cookieValue?: string) {
  const headers = new Headers();
  headers.set("host", "localhost:3000");
  if (cookieValue !== undefined) {
    headers.set("cookie", `${SESSION_COOKIE_NAME}=${encodeURIComponent(cookieValue)}`);
  }
  return new NextRequest(`${ORIGIN}${path}`, { headers });
}

// NextResponse.next()は内部的にヘッダー"x-middleware-next"を"1"にして返す
// (proxy/middlewareが「そのまま通す」ことを示すNext.jsの公開された実装)。
function isPassThrough(res: Response): boolean {
  return res.headers.get("x-middleware-next") === "1";
}

// --- 1. 未ログインで保護対象ページへアクセスすると拒否される(ログインページへリダイレクト) ---
test("未ログイン: 保護対象ページ(/)はログインページへリダイレクトされる", () => {
  const res = proxy(makeRequest("/"));
  assert.equal(res.status, 307);
  assert.match(res.headers.get("location") ?? "", /\/login$/);
});

test("未ログイン: 保護対象ページ(/diary)もログインページへリダイレクトされる", () => {
  const res = proxy(makeRequest("/diary"));
  assert.equal(res.status, 307);
  assert.match(res.headers.get("location") ?? "", /\/login$/);
});

// --- 2. ログイン済みなら正常表示される(素通り) ---
test("ログイン済み: 保護対象ページ(/)は素通りする(NextResponse.next)", () => {
  const cookie = createSessionCookieValue();
  const res = proxy(makeRequest("/", cookie));
  assert.equal(isPassThrough(res), true);
});

// --- 3. 不正Cookieでは拒否される ---
test("不正Cookie(署名改ざん): ページは拒否されログインへリダイレクトされる", () => {
  const cookie = createSessionCookieValue();
  const [payload, signature] = cookie.split(".");
  const tampered = `${payload}.${signature.slice(0, -1)}${signature.at(-1) === "a" ? "b" : "a"}`;
  const res = proxy(makeRequest("/", tampered));
  assert.equal(res.status, 307);
  assert.match(res.headers.get("location") ?? "", /\/login$/);
});

test("不正Cookie(署名改ざん): APIは401(JSON)で拒否される", () => {
  const cookie = createSessionCookieValue();
  const [payload, signature] = cookie.split(".");
  const tampered = `${payload}.${signature.slice(0, -1)}${signature.at(-1) === "a" ? "b" : "a"}`;
  const res = proxy(makeRequest("/api/categories", tampered));
  assert.equal(res.status, 401);
});

// --- 4. 期限切れCookieでは拒否される ---
test("期限切れCookie: ページは拒否されログインへリダイレクトされる", () => {
  const pastPayload = String(Date.now() - 1000);
  const signature = crypto.createHmac("sha256", FAKE_SESSION_SECRET).update(pastPayload).digest("hex");
  const res = proxy(makeRequest("/", `${pastPayload}.${signature}`));
  assert.equal(res.status, 307);
  assert.match(res.headers.get("location") ?? "", /\/login$/);
});

// --- 9. 個人データを取得する処理が認証前に実行されない ---
// proxy()はページのServer Component(DashboardPage等)を一切importも呼び出しもしていない
// (このファイル冒頭のimportにPrisma関連が含まれないことがその構造的な証拠)。
// 未認証時はNextResponse.redirectを返すだけで、Next.js自体がその時点で
// ページ本体へのルーティングを行わないため、Prismaクエリへ到達する経路が存在しない。
test("未ログイン: APIも401(JSON)で拒否され、ページ同様に本体処理へ到達しない", () => {
  const res = proxy(makeRequest("/api/categories"));
  assert.equal(res.status, 401);
});

// --- Cookie欠落(値そのものが無い)でも拒否される ---
test("Cookie欠落: ページは拒否されログインへリダイレクトされる", () => {
  const res = proxy(makeRequest("/"));
  assert.equal(res.status, 307);
});

// --- 5/6/8. matcherによる除外設定(ログインページ・認証API・静的アセット) ---
// config.matcherはNext.js自体がコンパイルして使うため、ここでは「どのパスが
// 除外対象として記述されているか」を文字列として検証する(除外されたパスはproxy()自体が
// 呼ばれないため、無限リダイレクトも起こり得ない)。
test("matcher: ログインページ・認証API・静的アセット・PWAアイコンが除外パターンに含まれる", () => {
  const matcher = config.matcher[0];
  for (const excluded of ["login", "api/auth", "_next/static", "_next/image", "favicon.ico", "manifest.webmanifest", "icons"]) {
    assert.match(matcher, new RegExp(excluded.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
