import { test, before } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  verifyPassword,
  createSessionCookieValue,
  verifySessionCookieValue,
  isSameOriginRequest,
  readLoginAttemptState,
  isLoginRateLimited,
  recordFailedLoginAttempt,
  buildLoginAttemptCookieValue,
  LOGIN_ATTEMPT_MAX,
} from "./auth";

// このファイルはテスト専用のダミーのsalt/hash/secretだけを使う。
// 実際の.envやログインパスワードには一切アクセスしない。
const FAKE_SALT = "test-salt-not-real";
const FAKE_PASSWORD = "test-password-123";
const FAKE_SESSION_SECRET = "test-session-secret-not-real";

before(() => {
  process.env.AUTH_PASSWORD_SALT = FAKE_SALT;
  process.env.AUTH_PASSWORD_HASH = crypto.scryptSync(FAKE_PASSWORD, FAKE_SALT, 64).toString("hex");
  process.env.AUTH_SESSION_SECRET = FAKE_SESSION_SECRET;
});

test("verifyPassword: 正しいテスト用パスワードはtrue", () => {
  assert.equal(verifyPassword(FAKE_PASSWORD), true);
});

test("verifyPassword: 誤ったパスワードはfalse", () => {
  assert.equal(verifyPassword("wrong-password"), false);
});

test("createSessionCookieValue -> verifySessionCookieValue: 発行直後は有効", () => {
  const cookie = createSessionCookieValue();
  assert.equal(verifySessionCookieValue(cookie), true);
});

test("verifySessionCookieValue: 値が空/未定義はfalse", () => {
  assert.equal(verifySessionCookieValue(undefined), false);
  assert.equal(verifySessionCookieValue(""), false);
});

test("verifySessionCookieValue: 署名を改ざんするとfalse", () => {
  const cookie = createSessionCookieValue();
  const [payload, signature] = cookie.split(".");
  const tampered = `${payload}.${signature.slice(0, -1)}${signature.at(-1) === "a" ? "b" : "a"}`;
  assert.equal(verifySessionCookieValue(tampered), false);
});

test("verifySessionCookieValue: 有効期限切れはfalse", () => {
  const pastPayload = String(Date.now() - 1000);
  const signature = crypto.createHmac("sha256", FAKE_SESSION_SECRET).update(pastPayload).digest("hex");
  assert.equal(verifySessionCookieValue(`${pastPayload}.${signature}`), false);
});

test("isSameOriginRequest: OriginがHostと一致すればtrue", () => {
  const req = new Request("http://localhost:3000/api/x", {
    headers: { origin: "http://localhost:3000", host: "localhost:3000" },
  });
  assert.equal(isSameOriginRequest(req), true);
});

test("isSameOriginRequest: Originが別ドメインならfalse", () => {
  const req = new Request("http://localhost:3000/api/x", {
    headers: { origin: "http://evil.example.com", host: "localhost:3000" },
  });
  assert.equal(isSameOriginRequest(req), false);
});

test("isSameOriginRequest: OriginもRefererも無ければfalse(fail-closed)", () => {
  const req = new Request("http://localhost:3000/api/x", { headers: { host: "localhost:3000" } });
  assert.equal(isSameOriginRequest(req), false);
});

test("isSameOriginRequest: Origin無しでもRefererが一致すればtrue", () => {
  const req = new Request("http://localhost:3000/api/x", {
    headers: { referer: "http://localhost:3000/some-page", host: "localhost:3000" },
  });
  assert.equal(isSameOriginRequest(req), true);
});

// --- ログイン試行回数制限 ---

test("readLoginAttemptState: Cookie無しは失敗0回の新規状態", () => {
  const state = readLoginAttemptState(undefined);
  assert.equal(state.count, 0);
  assert.equal(isLoginRateLimited(state), false);
});

test("readLoginAttemptState: 改ざんされたCookieは失敗0回扱い(fail-open、既知の限界)", () => {
  const state = readLoginAttemptState("999.1.deadbeef");
  assert.equal(state.count, 0);
});

test("recordFailedLoginAttempt: LOGIN_ATTEMPT_MAX回失敗するとレート制限される", () => {
  let state = readLoginAttemptState(undefined);
  for (let i = 0; i < LOGIN_ATTEMPT_MAX - 1; i++) {
    state = recordFailedLoginAttempt(state);
    assert.equal(isLoginRateLimited(state), false, `${i + 1}回目ではまだ制限されないはず`);
  }
  state = recordFailedLoginAttempt(state);
  assert.equal(isLoginRateLimited(state), true, `${LOGIN_ATTEMPT_MAX}回目で制限されるはず`);
});

test("buildLoginAttemptCookieValue -> readLoginAttemptState: 往復で値が保持される", () => {
  const state = recordFailedLoginAttempt(readLoginAttemptState(undefined));
  const cookie = buildLoginAttemptCookieValue(state);
  const parsed = readLoginAttemptState(cookie);
  assert.equal(parsed.count, state.count);
  assert.equal(parsed.windowStart, state.windowStart);
});

test("recordFailedLoginAttempt: ウィンドウ(15分)が過ぎていれば1回目として数え直す", () => {
  const oldState = { count: LOGIN_ATTEMPT_MAX, windowStart: Date.now() - 16 * 60 * 1000 };
  const next = recordFailedLoginAttempt(oldState);
  assert.equal(next.count, 1);
  assert.equal(isLoginRateLimited(next), false);
});

test("readLoginAttemptState: ウィンドウが切れたCookieは失敗0回として読み直される", () => {
  const oldPayload = `${LOGIN_ATTEMPT_MAX}.${Date.now() - 16 * 60 * 1000}`;
  const signature = crypto.createHmac("sha256", FAKE_SESSION_SECRET).update(oldPayload).digest("hex");
  const state = readLoginAttemptState(`${oldPayload}.${signature}`);
  assert.equal(state.count, 0);
});

test("fail-closed: AUTH_SESSION_SECRET未設定時、verifySessionCookieValueは例外を投げずfalseを返す", async () => {
  const saved = process.env.AUTH_SESSION_SECRET;
  delete process.env.AUTH_SESSION_SECRET;
  try {
    const dummy = `${Date.now() + 100000}.deadbeef`;
    assert.doesNotThrow(() => {
      const result = verifySessionCookieValue(dummy);
      assert.equal(result, false);
    });
  } finally {
    process.env.AUTH_SESSION_SECRET = saved;
  }
});
