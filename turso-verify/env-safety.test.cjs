// env-safety.cjs の単体テスト。ダミーの認証情報のみを使い、実際のTursoには一切接続しない。
// 目的: どんなエラーが起きても、設定した値(URL・トークン)がログに一切出力されないことの確認。

const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  cleanEnvValue,
  validateUrlFormat,
  validateTokenFormat,
  validateCredentials,
  safeErrorMessage,
} = require("./env-safety.cjs");

// 実際のトークンではない、テスト専用のダミーJWT風文字列(形式だけ本物に似せてある)。
const DUMMY_TOKEN = "eyJhbGciOiJkdW1teSJ9.eyJhIjoicm8iLCJkdW1teSI6dHJ1ZX0.ZHVtbXlzaWduYXR1cmU";
const DUMMY_URL = "libsql://dummy-test-db-for-unit-test.turso.io";

// --- cleanEnvValue ---

test("cleanEnvValue: 前後の括弧・引用符を取り除く", () => {
  assert.equal(cleanEnvValue(`("${DUMMY_URL}")`), DUMMY_URL);
  assert.equal(cleanEnvValue(`(${DUMMY_URL})`), DUMMY_URL);
  assert.equal(cleanEnvValue(`"${DUMMY_URL}"`), DUMMY_URL);
  assert.equal(cleanEnvValue(`  ${DUMMY_URL}  `), DUMMY_URL);
});

// --- validateUrlFormat ---

test("validateUrlFormat: 正しいlibsql://形式はok", () => {
  assert.equal(validateUrlFormat(DUMMY_URL).ok, true);
});

test("validateUrlFormat: JWT形式の値が混入していたら検知する(実際に発生した事故の再現)", () => {
  const r = validateUrlFormat(DUMMY_TOKEN);
  assert.equal(r.ok, false);
  assert.match(r.reason, /入れ替わっていないか/);
  assert.equal(r.reason.includes(DUMMY_TOKEN), false, "理由メッセージに値そのものを含めてはいけない");
});

test("validateUrlFormat: 空文字は不正", () => {
  assert.equal(validateUrlFormat("").ok, false);
});

test("validateUrlFormat: スキームの無い値は不正", () => {
  assert.equal(validateUrlFormat("growth-os-prod-xxxxx.turso.io").ok, false);
});

// --- validateTokenFormat ---

test("validateTokenFormat: 正しいJWT形式(3分割)はok", () => {
  assert.equal(validateTokenFormat(DUMMY_TOKEN).ok, true);
});

test("validateTokenFormat: URL形式の値が混入していたら検知する(実際に発生した事故の再現)", () => {
  const r = validateTokenFormat(DUMMY_URL);
  assert.equal(r.ok, false);
  assert.match(r.reason, /入れ替わっていないか/);
  assert.equal(r.reason.includes(DUMMY_URL), false);
});

test("validateTokenFormat: ピリオドが2つ無い値は不正", () => {
  assert.equal(validateTokenFormat("not-a-jwt-token").ok, false);
});

// --- validateCredentials ---

test("validateCredentials: 両方正しければok", () => {
  assert.equal(validateCredentials(DUMMY_URL, DUMMY_TOKEN).ok, true);
});

test("validateCredentials: 入れ替わっていれば、値を含まない理由で不正判定される", () => {
  const r = validateCredentials(DUMMY_TOKEN, DUMMY_URL); // 意図的に入れ替えて渡す
  assert.equal(r.ok, false);
  assert.equal(r.reason.includes(DUMMY_TOKEN), false);
  assert.equal(r.reason.includes(DUMMY_URL), false);
});

// --- safeErrorMessage: 最重要。どんな形のエラーでも値が絶対に漏れないことを確認する ---

test("safeErrorMessage: エラーメッセージに値が直接含まれていても除去される(実際の事故の再現)", () => {
  const fakeError = new Error(`URL_INVALID: The URL '${DUMMY_TOKEN}' is not in a valid format`);
  const msg = safeErrorMessage(fakeError, [DUMMY_URL, DUMMY_TOKEN]);
  assert.equal(msg.includes(DUMMY_TOKEN), false, "トークンの値が残っている(危険)");
  assert.match(msg, /\[REDACTED\]/);
});

test("safeErrorMessage: URL側の値が含まれる場合も除去される", () => {
  const fakeError = new Error(`connect ECONNREFUSED ${DUMMY_URL}`);
  const msg = safeErrorMessage(fakeError, [DUMMY_URL, DUMMY_TOKEN]);
  assert.equal(msg.includes(DUMMY_URL), false);
});

test("safeErrorMessage: 値を含まないエラーはそのまま(過剰に消しすぎない)", () => {
  const fakeError = new Error("timeout");
  const msg = safeErrorMessage(fakeError, [DUMMY_URL, DUMMY_TOKEN]);
  assert.equal(msg, "timeout");
});

test("safeErrorMessage: secretsが空/未指定でも例外を投げない", () => {
  assert.doesNotThrow(() => safeErrorMessage(new Error("x"), []));
  assert.doesNotThrow(() => safeErrorMessage(new Error("x"), undefined));
});

test("safeErrorMessage: 複数行のエラーでも1行目だけを使い、値は除去される", () => {
  const fakeError = new Error(`first line with ${DUMMY_TOKEN}\nsecond line\nthird line`);
  const msg = safeErrorMessage(fakeError, [DUMMY_TOKEN]);
  assert.equal(msg.includes("\n"), false);
  assert.equal(msg.includes(DUMMY_TOKEN), false);
});

console.log("\n全テストを実行しました(node:testのサマリーは標準出力の上部を参照)。");
