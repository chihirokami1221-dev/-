import { test, before } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  verifyPassword,
  createSessionCookieValue,
  verifySessionCookieValue,
  isSameOriginRequest,
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
