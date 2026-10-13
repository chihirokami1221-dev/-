import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

// 重要: Prisma Clientは、インポートされた時点でプロジェクトの.envを自動的に読み込む
// (dotenvの標準動作により、既にprocess.envに値がある変数は上書きしない)。
// そのため、本物のローカルSQLite/Tursoに一切接続しないよう、
// 他のどのインポートよりも前に、ダミーの接続先で明示的に上書きしておく。
process.env.DATABASE_URL = "file::memory:";
process.env.TURSO_DATABASE_URL = "";
process.env.TURSO_AUTH_TOKEN = "";

const FAKE_SALT = "test-salt";
const FAKE_PASSWORD = "test-password-123";
process.env.AUTH_PASSWORD_SALT = FAKE_SALT;
process.env.AUTH_PASSWORD_HASH = crypto.scryptSync(FAKE_PASSWORD, FAKE_SALT, 64).toString("hex");
process.env.AUTH_SESSION_SECRET = "test-session-secret";

// 上記の環境変数を設定し終えた後で、動的importを使って初めてPrisma/ルートハンドラーを読み込む。
// (静的importは常にファイル先頭へ巻き上げられ、上の上書きより先に実行されてしまうため使わない)
let NextRequest: typeof import("next/server").NextRequest;
let createSessionCookieValue: typeof import("../../lib/auth").createSessionCookieValue;
let SESSION_COOKIE_NAME: typeof import("../../lib/auth").SESSION_COOKIE_NAME;
let chatPOST: typeof import("./chat/route").POST;
let analyzePOST: typeof import("./diary/[id]/analyze/route").POST;
let extractPOST: typeof import("./diary/[id]/extract-achievement/route").POST;

before(async () => {
  ({ NextRequest } = await import("next/server"));
  ({ createSessionCookieValue, SESSION_COOKIE_NAME } = await import("../../lib/auth"));
  ({ POST: chatPOST } = await import("./chat/route"));
  ({ POST: analyzePOST } = await import("./diary/[id]/analyze/route"));
  ({ POST: extractPOST } = await import("./diary/[id]/extract-achievement/route"));
});

after(() => {
  delete process.env.AI_FEATURES_DISABLED;
});

const ORIGIN = "http://localhost:3000";

function makeRequest(path: string, opts: { authed?: boolean; origin?: string | null } = {}) {
  const headers = new Headers();
  headers.set("host", "localhost:3000");
  if (opts.origin !== null) headers.set("origin", opts.origin ?? ORIGIN);
  if (opts.authed) headers.set("cookie", `${SESSION_COOKIE_NAME}=${encodeURIComponent(createSessionCookieValue())}`);
  headers.set("content-type", "application/json");
  return new NextRequest(`${ORIGIN}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
  });
}

// --- 1. AI機能が無効な場合、Ollamaへの接続処理が呼ばれない & 2. 分かるレスポンスが返る ---

test("AI無効時: /api/chat はOllamaに接続せず、案内メッセージをストリームで返す", async () => {
  process.env.AI_FEATURES_DISABLED = "true";
  const res = await chatPOST(makeRequest("/api/chat", { authed: true }));
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.match(text, /Web版では利用できません/);
});

test("AI無効時: /api/diary/[id]/analyze はDBに触れず503とエラーメッセージを返す", async () => {
  process.env.AI_FEATURES_DISABLED = "true";
  const res = await analyzePOST(makeRequest("/api/diary/dummy/analyze", { authed: true }), {
    params: Promise.resolve({ id: "dummy" }),
  });
  assert.equal(res.status, 503);
  const data = await res.json();
  assert.match(data.error, /Web版では利用できません/);
});

test("AI無効時: /api/diary/[id]/extract-achievement はDBに触れず503とエラーメッセージを返す", async () => {
  process.env.AI_FEATURES_DISABLED = "true";
  const res = await extractPOST(makeRequest("/api/diary/dummy/extract-achievement", { authed: true }), {
    params: Promise.resolve({ id: "dummy" }),
  });
  assert.equal(res.status, 503);
  const data = await res.json();
  assert.match(data.error, /Web版では利用できません/);
});

// --- 3. 無効な場合でも既存の認証・Origin検証が維持される ---

test("AI無効時でも未認証なら401(認証チェックが先に実行される)", async () => {
  process.env.AI_FEATURES_DISABLED = "true";
  const res = await analyzePOST(makeRequest("/api/diary/dummy/analyze", { authed: false }), {
    params: Promise.resolve({ id: "dummy" }),
  });
  assert.equal(res.status, 401);
});

test("AI無効時でもOrigin不一致なら403(CSRFチェックが先に実行される)", async () => {
  process.env.AI_FEATURES_DISABLED = "true";
  const res = await extractPOST(
    makeRequest("/api/diary/dummy/extract-achievement", { authed: true, origin: "http://evil.example.com" }),
    { params: Promise.resolve({ id: "dummy" }) },
  );
  assert.equal(res.status, 403);
});

// --- 4. 有効な場合(AI_FEATURES_DISABLED未設定)、既存の処理フローが維持される ---
// DBは本物ではなく空のin-memory SQLite(テーブル無し)に接続している。
// 短絡せず実処理へ進めば、テーブルが存在せずクエリが失敗する=例外が発生することを根拠にする。

test("AI有効時(未設定): /api/diary/[id]/analyze は短絡せず、DB問い合わせまで進んで失敗する", async () => {
  delete process.env.AI_FEATURES_DISABLED;
  await assert.rejects(() =>
    analyzePOST(makeRequest("/api/diary/dummy/analyze", { authed: true }), {
      params: Promise.resolve({ id: "dummy" }),
    }),
  );
});

test("AI有効時(未設定): /api/chat は短絡せず、システムプロンプト構築のDB問い合わせまで進んで失敗する", async () => {
  delete process.env.AI_FEATURES_DISABLED;
  await assert.rejects(() => chatPOST(makeRequest("/api/chat", { authed: true })));
});

// --- 5. 無効化処理によってデータが変更されないこと ---
// analyze/extract-achievementの無効時レスポンスが503で正常返却されたこと自体が、
// prisma.diaryEntry.update等の書き込みに到達していない(DBに触れていない)ことの証拠になる。
test("AI無効時: analyzeは日記データを更新する処理(DB書き込み)に到達しない", async () => {
  process.env.AI_FEATURES_DISABLED = "true";
  const res = await analyzePOST(makeRequest("/api/diary/dummy/analyze", { authed: true }), {
    params: Promise.resolve({ id: "dummy" }),
  });
  assert.equal(res.status, 503);
});
