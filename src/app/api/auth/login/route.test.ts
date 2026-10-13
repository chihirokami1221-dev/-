import { test, before } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

// Prisma Clientの自動.env読み込みを避ける(このテストはログインAPIのみを対象とし、
// DBには一切接続しない)。
process.env.DATABASE_URL = "file::memory:";
process.env.TURSO_DATABASE_URL = "";
process.env.TURSO_AUTH_TOKEN = "";

const FAKE_SALT = "test-salt-not-real";
const FAKE_PASSWORD = "test-password-123";
const FAKE_SESSION_SECRET = "test-session-secret-not-real";

let NextRequest: typeof import("next/server").NextRequest;
let POST: typeof import("./route").POST;
let LOGIN_ATTEMPT_COOKIE_NAME: typeof import("@/lib/auth").LOGIN_ATTEMPT_COOKIE_NAME;
let LOGIN_ATTEMPT_MAX: typeof import("@/lib/auth").LOGIN_ATTEMPT_MAX;

before(async () => {
  process.env.AUTH_PASSWORD_SALT = FAKE_SALT;
  process.env.AUTH_PASSWORD_HASH = crypto.scryptSync(FAKE_PASSWORD, FAKE_SALT, 64).toString("hex");
  process.env.AUTH_SESSION_SECRET = FAKE_SESSION_SECRET;

  ({ NextRequest } = await import("next/server"));
  ({ POST } = await import("./route"));
  ({ LOGIN_ATTEMPT_COOKIE_NAME, LOGIN_ATTEMPT_MAX } = await import("@/lib/auth"));
});

const ORIGIN = "http://localhost:3000";

function makeRequest(password: string, attemptCookie?: string) {
  const headers = new Headers();
  headers.set("host", "localhost:3000");
  headers.set("origin", ORIGIN);
  headers.set("content-type", "application/json");
  if (attemptCookie !== undefined) {
    headers.set("cookie", `${LOGIN_ATTEMPT_COOKIE_NAME}=${encodeURIComponent(attemptCookie)}`);
  }
  return new NextRequest(`${ORIGIN}/api/auth/login`, {
    method: "POST",
    headers,
    body: JSON.stringify({ password }),
  });
}

function getAllSetCookies(res: Response): string[] {
  const withGetSetCookie = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof withGetSetCookie.getSetCookie === "function") return withGetSetCookie.getSetCookie();
  const raw = res.headers.get("set-cookie");
  return raw ? [raw] : [];
}

function extractCookieValue(res: Response, name: string): string | undefined {
  for (const raw of getAllSetCookies(res)) {
    const match = raw.split(";")[0];
    if (match.startsWith(`${name}=`)) return decodeURIComponent(match.slice(name.length + 1));
  }
  return undefined;
}

test("正しいパスワードでログイン成功(200)", async () => {
  const res = await POST(makeRequest(FAKE_PASSWORD));
  assert.equal(res.status, 200);
});

test("誤ったパスワードは401、Origin不一致は既存通り403のまま(回帰確認)", async () => {
  const res = await POST(makeRequest("wrong-password"));
  assert.equal(res.status, 401);
});

test("LOGIN_ATTEMPT_MAX回連続で失敗すると、それ以降は429(パスワード検証自体を行わない)", async () => {
  let cookie: string | undefined;
  // LOGIN_ATTEMPT_MAX回の失敗で、ちょうど count=LOGIN_ATTEMPT_MAX になる(この時点ではまだ401)。
  for (let i = 0; i < LOGIN_ATTEMPT_MAX; i++) {
    const res = await POST(makeRequest("wrong-password", cookie));
    assert.equal(res.status, 401, `${i + 1}回目は401のはず`);
    cookie = extractCookieValue(res, LOGIN_ATTEMPT_COOKIE_NAME) ?? cookie;
  }

  // 次の(LOGIN_ATTEMPT_MAX+1回目の)リクエストで、事前チェックによりブロックされる。
  const limitedRes = await POST(makeRequest("wrong-password", cookie));
  assert.equal(limitedRes.status, 429);

  // レート制限中は、正しいパスワードを送っても拒否される(検証自体をスキップするため)。
  const evenCorrectRes = await POST(makeRequest(FAKE_PASSWORD, cookie));
  assert.equal(evenCorrectRes.status, 429);
});

test("ログイン成功後、失敗回数Cookieが削除される(リセットされる)", async () => {
  // まず数回失敗させる。
  let cookie: string | undefined;
  for (let i = 0; i < 2; i++) {
    const res = await POST(makeRequest("wrong-password", cookie));
    cookie = extractCookieValue(res, LOGIN_ATTEMPT_COOKIE_NAME) ?? cookie;
  }
  assert.ok(cookie, "失敗後はCookieが発行されているはず");

  const successRes = await POST(makeRequest(FAKE_PASSWORD, cookie));
  assert.equal(successRes.status, 200);
  const deleteCookie = getAllSetCookies(successRes).find((c) => c.startsWith(`${LOGIN_ATTEMPT_COOKIE_NAME}=`));
  assert.ok(deleteCookie, "失敗回数Cookieを削除するSet-Cookieが含まれているはず");
  assert.match(deleteCookie, /^growth_os_login_attempts=;/);
});
