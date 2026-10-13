// turso-sync-backup.cjs の単体テスト(node:test)。
// 実際のTuroso(growth-os-test等)には一切接続しない。ローカルの合成データ・
// 意図的に失敗させるローカルアドレスのみを使う。
// 実行方法: node turso-sync-backup.test.cjs ("src/**/*.test.ts"のnpm testには含めない)

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { createClient } = require("@libsql/client");

const {
  runTursoSyncBackup,
  canonicalValue,
  rowHash,
  snapshotLocalFile,
  decideSuccess,
  reserveFile,
  retryOnBusy,
  cleanupSiblings,
  copyWithSiblings,
  TABLES,
} = require("./turso-sync-backup.cjs");

// --- canonicalValue / rowHash ---

test("canonicalValue: nullとBLOBを区別できる", () => {
  assert.equal(canonicalValue(null), "\u0000NULL\u0000");
  assert.match(canonicalValue(new ArrayBuffer(0)), /^\u0000BLOB:/);
  assert.equal(canonicalValue(""), '""');
});

test("rowHash: 同じ内容は同じハッシュ、1文字でも違えば別ハッシュ", () => {
  const cols = ["id", "title"];
  const h1 = rowHash({ id: "1", title: "テスト" }, cols);
  const h2 = rowHash({ id: "1", title: "テスト" }, cols);
  const h3 = rowHash({ id: "1", title: "テスト " }, cols);
  assert.equal(h1, h2);
  assert.notEqual(h1, h3);
});

// --- decideSuccess ---

test("decideSuccess: 全テーブル件数一致・integrity ok なら成功", () => {
  const remote = { ...Object.fromEntries(TABLES.map((t) => [t, 0])) };
  const local = { integrity: "ok", counts: { ...remote } };
  const r = decideSuccess(remote, local);
  assert.equal(r.success, true);
});

test("decideSuccess: 1テーブルでも件数不一致なら失敗", () => {
  const remote = { ...Object.fromEntries(TABLES.map((t) => [t, 0])) };
  const local = { integrity: "ok", counts: { ...remote, Memo: 1 } };
  const r = decideSuccess(remote, local);
  assert.equal(r.success, false);
  assert.match(r.reason, /Memo/);
});

test("decideSuccess: integrity_checkがok以外なら件数が一致していても失敗", () => {
  const remote = { ...Object.fromEntries(TABLES.map((t) => [t, 0])) };
  const local = { integrity: "corrupted-for-test", counts: { ...remote } };
  const r = decideSuccess(remote, local);
  assert.equal(r.success, false);
});

// --- reserveFile ---

test("reserveFile: 新規パスは確保でき、同じパスの2回目は失敗する(上書き防止)", () => {
  const tmp = path.join(os.tmpdir(), `reserve-test-${Date.now()}.tmp`);
  try {
    const r1 = reserveFile(tmp);
    assert.equal(r1.ok, true);
    const r2 = reserveFile(tmp);
    assert.equal(r2.ok, false);
  } finally {
    fs.unlinkSync(tmp);
  }
});

// --- snapshotLocalFile (ローカル合成データのみ、@libsql/clientで作成したファイルを
//     node:sqliteで開けること=Phase D-4の互換性検証をこのスクリプト内でも再確認) ---

test("snapshotLocalFile: @libsql/clientで作った合成ファイルを正しく読み取れる", async () => {
  const dbPath = path.join(os.tmpdir(), `turso-sync-backup-test-${Date.now()}.db`);
  const client = createClient({ url: `file:${dbPath}` });
  try {
    await client.executeMultiple(`
      CREATE TABLE "Memo" ("id" TEXT NOT NULL PRIMARY KEY, "title" TEXT NOT NULL, "content" TEXT NOT NULL, "sourceKey" TEXT, "updatedAt" DATETIME NOT NULL);
    `);
    await client.execute({
      sql: `INSERT INTO "Memo" (id, title, content, sourceKey, updatedAt) VALUES (?, ?, ?, ?, ?)`,
      args: ["m1", "合成データ", "内容", null, "2026-01-01T00:00:00.000Z"],
    });
  } finally {
    client.close();
  }

  const snap = snapshotLocalFile(dbPath);
  assert.equal(snap.integrity, "ok");
  assert.equal(snap.counts.Memo, 1);
  assert.equal(snap.counts.Category, null); // 存在しないテーブルはnull扱い

  // Windowsではclose()直後にEBUSYになることがあるため(実際にテストで検出)、リトライする。
  // どの程度の時間ロックが残るかを調べるため、通常より長い予算で試す(診断目的)。
  await retryOnBusy(() => fs.unlinkSync(dbPath), 20, 500);
  for (const suffix of ["-wal", "-shm"]) {
    try { await retryOnBusy(() => fs.unlinkSync(dbPath + suffix), 20, 500); } catch {}
  }
});

// --- runTursoSyncBackup: 失敗系(実際のTursoには一切接続しない) ---

test("runTursoSyncBackup: 環境変数(URL/トークン)が無い場合、ネットワーク接続せず即座に失敗する", async () => {
  const logs = [];
  const r = await runTursoSyncBackup({ remoteUrl: undefined, authToken: undefined, log: (m) => logs.push(m) });
  assert.equal(r.success, false);
  assert.match(logs.join("\n"), /環境変数未設定/);
});

test("runTursoSyncBackup: リモート直結の件数取得に失敗する場合(到達不能アドレス)は失敗扱いになる", async () => {
  const tmpDir = path.join(os.tmpdir(), `turso-sync-backup-test-dir-${Date.now()}`);
  const logs = [];
  const r = await runTursoSyncBackup({
    remoteUrl: "http://127.0.0.1:1", // 到達不能(ポート1は通常何も listen していない)。本物のTursoではない。
    authToken: "dummy-token-for-local-failure-test-only",
    backupDir: tmpDir,
    prefix: "faketest",
    countTimeoutMs: 3000, // テストを高速化するため短いタイムアウトにする(修正前は約5分ハングしていた)。
    log: (m) => logs.push(m),
  });
  assert.equal(r.success, false);
  assert.match(logs.join("\n"), /RESULT=FAILURE/);
  // 失敗時はディレクトリ内に残留ファイルが無いこと(後片付けの確認)。
  if (fs.existsSync(tmpDir)) {
    const remaining = fs.readdirSync(tmpDir);
    assert.deepEqual(remaining, []);
    fs.rmdirSync(tmpDir);
  }
});

// --- copyWithSiblings: 本体+付随ファイルが命名対応を保ってコピーされること ---

test("copyWithSiblings: 本体ファイルと付随ファイルの両方が、destPathとの命名対応を保ってコピーされる", () => {
  const dir = os.tmpdir();
  const base = path.join(dir, `copy-sib-test-${Date.now()}.db`);
  const dest = path.join(dir, `copy-sib-test-${Date.now()}-dest.db`);
  fs.writeFileSync(base, "main-content");
  fs.writeFileSync(base + "-client_wal_index", "sidecar-content");
  try {
    copyWithSiblings(base, dest);
    assert.equal(fs.readFileSync(dest, "utf8"), "main-content");
    assert.equal(fs.readFileSync(dest + "-client_wal_index", "utf8"), "sidecar-content");
  } finally {
    for (const p of [base, base + "-client_wal_index", dest, dest + "-client_wal_index"]) {
      try { fs.unlinkSync(p); } catch {}
    }
  }
});

// --- cleanupSiblings: 今回の実行専用ファイルだけを削除し、無関係な既存ファイルは残す ---

test("cleanupSiblings: 対象外の既存ファイル(似た名前・無関係な名前)を誤削除しない", async () => {
  const dir = path.join(os.tmpdir(), `cleanup-scope-test-${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, "run_replica_2026-01-01T00-00-00-000Z.db");
  const targetSibling = target + "-client_wal_index";
  const unrelatedOlderRun = path.join(dir, "run_replica_2025-12-31T23-59-59-999Z.db"); // 別実行の既存ファイル
  const unrelatedOtherFile = path.join(dir, "important_existing_backup.db"); // 全く無関係な既存ファイル
  fs.writeFileSync(target, "x");
  fs.writeFileSync(targetSibling, "x");
  fs.writeFileSync(unrelatedOlderRun, "x");
  fs.writeFileSync(unrelatedOtherFile, "x");

  try {
    await cleanupSiblings(target);
    assert.equal(fs.existsSync(target), false, "対象ファイル自体は削除されるべき");
    assert.equal(fs.existsSync(targetSibling), false, "対象の付随ファイルは削除されるべき");
    assert.equal(fs.existsSync(unrelatedOlderRun), true, "別実行の既存ファイルは残すべき(誤削除禁止)");
    assert.equal(fs.existsSync(unrelatedOtherFile), true, "無関係な既存ファイルは残すべき(誤削除禁止)");
  } finally {
    for (const p of [target, targetSibling, unrelatedOlderRun, unrelatedOtherFile]) {
      try { fs.unlinkSync(p); } catch {}
    }
    fs.rmdirSync(dir);
  }
});

console.log("\n全テストを実行しました(node:testのサマリーは標準出力の上部を参照)。");
