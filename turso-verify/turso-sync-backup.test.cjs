// turso-sync-backup.cjs(@libsql/client 0.18.0版)の単体・統合テスト。
// 実際のTursoには一切接続しない(ローカル合成データ・到達不能アドレスのみ使用)。
// 実行方法: node --test turso-sync-backup.test.cjs

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { createClient } = require("@libsql/client");
const { DatabaseSync } = require("node:sqlite");

const {
  runTursoSyncBackup,
  canonicalValue,
  rowHash,
  snapshotLocalFile,
  decideSuccess,
  fetchRemoteSnapshot,
  reserveFile,
  retryOnBusy,
  cleanupSiblings,
  copyWithSiblings,
  consolidateSnapshot,
  TABLES,
} = require("./turso-sync-backup.cjs");

// --- 基本の単体テスト(値の正規化・判定ロジック) ---

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

test("decideSuccess: 件数・ハッシュが全て一致・integrity ok なら成功", () => {
  const empty = Object.fromEntries(TABLES.map((t) => [t, 0]));
  const emptyHash = Object.fromEntries(TABLES.map((t) => [t, []]));
  const r = decideSuccess({ counts: empty, hashes: emptyHash }, { integrity: "ok", counts: empty, hashes: emptyHash });
  assert.equal(r.success, true);
});

test("decideSuccess: 件数が同じでも内容ハッシュが違えば失敗(件数だけでは検知できない不一致)", () => {
  const counts = { ...Object.fromEntries(TABLES.map((t) => [t, 0])), Memo: 1 };
  const remoteHashes = { ...Object.fromEntries(TABLES.map((t) => [t, []])), Memo: [{ id: "m1", hash: "aaa" }] };
  const localHashes = { ...Object.fromEntries(TABLES.map((t) => [t, []])), Memo: [{ id: "m1", hash: "bbb" }] };
  const r = decideSuccess({ counts, hashes: remoteHashes }, { integrity: "ok", counts, hashes: localHashes });
  assert.equal(r.success, false);
  assert.match(r.reason, /Memo/);
});

test("decideSuccess: integrity_checkがok以外なら件数・ハッシュが一致していても失敗", () => {
  const counts = Object.fromEntries(TABLES.map((t) => [t, 0]));
  const hashes = Object.fromEntries(TABLES.map((t) => [t, []]));
  const r = decideSuccess({ counts, hashes }, { integrity: "corrupted-for-test", counts, hashes });
  assert.equal(r.success, false);
});

test("reserveFile: 新規パスは確保でき、同じパスの2回目は失敗する(上書き防止)", () => {
  const tmp = path.join(os.tmpdir(), `reserve-test-${Date.now()}.tmp`);
  try {
    assert.equal(reserveFile(tmp).ok, true);
    assert.equal(reserveFile(tmp).ok, false);
  } finally {
    fs.unlinkSync(tmp);
  }
});

test("copyWithSiblings: 本体と付随ファイルの両方が命名対応を保ってコピーされる", () => {
  const dir = os.tmpdir();
  const base = path.join(dir, `copy-sib-${Date.now()}.db`);
  const dest = path.join(dir, `copy-sib-${Date.now()}-dest.db`);
  fs.writeFileSync(base, "main");
  fs.writeFileSync(base + "-client_wal_index", "sidecar");
  try {
    copyWithSiblings(base, dest);
    assert.equal(fs.readFileSync(dest, "utf8"), "main");
    assert.equal(fs.readFileSync(dest + "-client_wal_index", "utf8"), "sidecar");
  } finally {
    for (const p of [base, base + "-client_wal_index", dest, dest + "-client_wal_index"]) {
      try { fs.unlinkSync(p); } catch {}
    }
  }
});

test("cleanupSiblings: 対象外の既存ファイル(別実行・無関係)を誤削除しない", async () => {
  const dir = path.join(os.tmpdir(), `cleanup-scope-${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, "run_replica_2026-01-01T00-00-00-000Z.db");
  const unrelatedOlderRun = path.join(dir, "run_replica_2025-12-31T23-59-59-999Z.db");
  const unrelatedOtherFile = path.join(dir, "important_existing_backup.db");
  fs.writeFileSync(target, "x");
  fs.writeFileSync(unrelatedOlderRun, "x");
  fs.writeFileSync(unrelatedOtherFile, "x");
  try {
    await cleanupSiblings(target);
    assert.equal(fs.existsSync(target), false);
    assert.equal(fs.existsSync(unrelatedOlderRun), true, "別実行の既存ファイルは残すべき");
    assert.equal(fs.existsSync(unrelatedOtherFile), true, "無関係な既存ファイルは残すべき");
  } finally {
    for (const p of [target, unrelatedOlderRun, unrelatedOtherFile]) { try { fs.unlinkSync(p); } catch {} }
    fs.rmdirSync(dir);
  }
});

test("runTursoSyncBackup: 環境変数が無い場合、ネットワーク接続せず即座に失敗する", async () => {
  const logs = [];
  const r = await runTursoSyncBackup({ remoteUrl: undefined, authToken: undefined, log: (m) => logs.push(m) });
  assert.equal(r.success, false);
  assert.match(logs.join("\n"), /環境変数未設定/);
});

test("runTursoSyncBackup: 到達不能アドレスへの接続は短時間で失敗し、残留ファイルが無い", async () => {
  const tmpDir = path.join(os.tmpdir(), `turso-fail-${Date.now()}`);
  const logs = [];
  const r = await runTursoSyncBackup({
    remoteUrl: "http://127.0.0.1:1",
    authToken: "dummy-token-for-local-failure-test-only",
    backupDir: tmpDir,
    prefix: "faketest",
    countTimeoutMs: 3000,
    log: (m) => logs.push(m),
  });
  assert.equal(r.success, false);
  if (fs.existsSync(tmpDir)) {
    assert.deepEqual(fs.readdirSync(tmpDir), []);
    fs.rmdirSync(tmpDir);
  }
});

// --- C. ローカル合成データによる統合テスト ---
// 日本語・絵文字・NULL・空文字・日付・複数テーブル・外部キー・インデックス・件数/内容ハッシュ・
// 復元したローカルDBとの一致を、実際のfetchRemoteSnapshot/snapshotLocalFile/decideSuccessを
// 使って検証する(syncUrlは使わず、"file:"を直結接続のように扱うことでネットワーク不要にする)。

async function buildSyntheticSource(dbPath) {
  const client = createClient({ url: `file:${dbPath}` });
  try {
    await client.executeMultiple(`
      CREATE TABLE "Category" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "key" TEXT NOT NULL UNIQUE,
        "label" TEXT NOT NULL,
        "color" TEXT NOT NULL
      );
      CREATE TABLE "RoadmapItem" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "title" TEXT NOT NULL,
        "categoryId" TEXT NOT NULL,
        "note" TEXT,
        "updatedAt" DATETIME NOT NULL,
        FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
      );
      CREATE INDEX "RoadmapItem_categoryId_idx" ON "RoadmapItem"("categoryId");
      CREATE TABLE "Memo" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "title" TEXT NOT NULL,
        "content" TEXT NOT NULL,
        "sourceKey" TEXT,
        "updatedAt" DATETIME NOT NULL
      );
    `);
    await client.execute({
      sql: `INSERT INTO "Category" (id, key, label, color) VALUES (?, ?, ?, ?)`,
      args: ["cat1", "test_jp", "日本語カテゴリ🎉", "#123456"],
    });
    await client.execute({
      sql: `INSERT INTO "RoadmapItem" (id, title, categoryId, note, updatedAt) VALUES (?, ?, ?, ?, ?)`,
      args: ["rm1", "改行入り\nタイトル", "cat1", null, "2028-02-29T00:00:00.000Z"],
    });
    await client.execute({
      sql: `INSERT INTO "Memo" (id, title, content, sourceKey, updatedAt) VALUES (?, ?, ?, ?, ?)`,
      args: ["m1", "空メモ", "", null, "2026-01-01T00:00:00.000Z"],
    });
    await client.execute({
      sql: `INSERT INTO "Memo" (id, title, content, sourceKey, updatedAt) VALUES (?, ?, ?, ?, ?)`,
      args: ["m2", "絵文字🎉㊗️", "内容テキスト", "src-key", "2026-12-31T23:59:59.999Z"],
    });
  } finally {
    client.close();
  }
}

// snapshotLocalFile/fetchRemoteSnapshotはTABLES(本番13テーブル)を前提にしているため、
// このテストでは3テーブル(Category, RoadmapItem, Memo)だけが実在し、残り10テーブルは
// 「存在しない」としてnull扱いになる想定で比較する(本番との差はテーブル数だけ)。
test("統合: 日本語・絵文字・NULL・空文字・日付・FK・インデックスを含む合成データで、件数・内容ハッシュが完全一致する", async () => {
  const dir = os.tmpdir();
  const sourcePath = path.join(dir, `synth-source-${Date.now()}.db`);
  const snapshotPath = path.join(dir, `synth-snapshot-${Date.now()}.db`);
  await buildSyntheticSource(sourcePath);

  // 「クローズ後に別名へコピーする」という本番の流れを再現する。
  copyWithSiblings(sourcePath, snapshotPath);

  const remoteSnapshot = await fetchRemoteSnapshot(`file:${sourcePath}`, undefined);
  const localSnapshot = snapshotLocalFile(snapshotPath);

  assert.equal(localSnapshot.integrity, "ok");
  assert.equal(remoteSnapshot.counts.Category, 1);
  assert.equal(remoteSnapshot.counts.RoadmapItem, 1);
  assert.equal(remoteSnapshot.counts.Memo, 2);
  assert.equal(remoteSnapshot.counts.Achievement, null); // 存在しないテーブルはnull扱い

  const decision = decideSuccess(remoteSnapshot, localSnapshot);
  assert.equal(decision.success, true, decision.reason);

  // --- 復元検証: スナップショットの内容を、新しい空DBへ再構築し、元と一致するか確認する ---
  const restoredPath = path.join(dir, `synth-restored-${Date.now()}.db`);
  const snap = new DatabaseSync(snapshotPath, { readOnly: true });
  const restored = new DatabaseSync(restoredPath);
  try {
    restored.exec(`
      CREATE TABLE "Category" ("id" TEXT NOT NULL PRIMARY KEY, "key" TEXT NOT NULL UNIQUE, "label" TEXT NOT NULL, "color" TEXT NOT NULL);
      CREATE TABLE "RoadmapItem" ("id" TEXT NOT NULL PRIMARY KEY, "title" TEXT NOT NULL, "categoryId" TEXT NOT NULL, "note" TEXT, "updatedAt" DATETIME NOT NULL);
      CREATE TABLE "Memo" ("id" TEXT NOT NULL PRIMARY KEY, "title" TEXT NOT NULL, "content" TEXT NOT NULL, "sourceKey" TEXT, "updatedAt" DATETIME NOT NULL);
    `);
    for (const t of ["Category", "RoadmapItem", "Memo"]) {
      const cols = snap.prepare(`PRAGMA table_info("${t}")`).all().map((c) => c.name);
      const rows = snap.prepare(`SELECT * FROM "${t}"`).all();
      const placeholders = cols.map(() => "?").join(",");
      const stmt = restored.prepare(`INSERT INTO "${t}" (${cols.map((c) => `"${c}"`).join(",")}) VALUES (${placeholders})`);
      for (const r of rows) stmt.run(...cols.map((c) => r[c]));
    }
  } finally {
    snap.close();
    restored.close();
  }

  const restoredSnapshot = snapshotLocalFile(restoredPath);
  assert.deepEqual(restoredSnapshot.hashes.Category, localSnapshot.hashes.Category);
  assert.deepEqual(restoredSnapshot.hashes.RoadmapItem, localSnapshot.hashes.RoadmapItem);
  assert.deepEqual(restoredSnapshot.hashes.Memo, localSnapshot.hashes.Memo);

  for (const p of [sourcePath, snapshotPath, restoredPath]) {
    for (const suffix of ["", "-wal", "-shm"]) { try { fs.unlinkSync(p + suffix); } catch {} }
  }
});

test("統合: 改ざんされたスナップショットは不一致として検知される(ハッシュ照合が機能している証拠)", async () => {
  const dir = os.tmpdir();
  const sourcePath = path.join(dir, `synth-source2-${Date.now()}.db`);
  const snapshotPath = path.join(dir, `synth-snapshot2-${Date.now()}.db`);
  await buildSyntheticSource(sourcePath);
  copyWithSiblings(sourcePath, snapshotPath);

  // スナップショット側だけ改ざんする(本番のコピー処理とは無関係に、テストのために直接書き込む)。
  const tamperDb = new DatabaseSync(snapshotPath);
  tamperDb.exec(`UPDATE "Memo" SET content = '改ざんされた内容' WHERE id = 'm2'`);
  tamperDb.close();

  const remoteSnapshot = await fetchRemoteSnapshot(`file:${sourcePath}`, undefined);
  const localSnapshot = snapshotLocalFile(snapshotPath);
  const decision = decideSuccess(remoteSnapshot, localSnapshot);

  assert.equal(decision.success, false);
  assert.match(decision.reason, /Memo/);

  for (const p of [sourcePath, snapshotPath]) {
    for (const suffix of ["", "-wal", "-shm"]) { try { fs.unlinkSync(p + suffix); } catch {} }
  }
});

// --- A. consolidateSnapshot: チェックポイント後、本体ファイル単独で内容を再現できること ---

test("consolidateSnapshot: チェックポイント後にWAL/SHMが削除され、本体ファイル単独で全データが読める", async () => {
  const dbPath = path.join(os.tmpdir(), `consolidate-test-${Date.now()}.db`);
  const client = createClient({ url: `file:${dbPath}` });
  await client.executeMultiple(`CREATE TABLE "Memo" ("id" TEXT PRIMARY KEY, "v" TEXT);`);
  for (let i = 0; i < 30; i++) {
    await client.execute({ sql: `INSERT INTO "Memo" (id, v) VALUES (?, ?)`, args: [`m${i}`, `v${i}`] });
  }
  client.close();
  await retryOnBusy(() => fs.statSync(dbPath));

  await consolidateSnapshot(dbPath);

  const dir = path.dirname(dbPath);
  const base = path.basename(dbPath);
  const siblings = fs.readdirSync(dir).filter((f) => f !== base && f.startsWith(base));
  assert.deepEqual(siblings, [], "チェックポイント後は付随ファイルが残っていないべき");

  const db = new DatabaseSync(dbPath, { readOnly: true });
  const integrity = db.prepare("PRAGMA integrity_check").get().integrity_check;
  const count = db.prepare(`SELECT COUNT(*) as c FROM "Memo"`).get().c;
  db.close();
  assert.equal(integrity, "ok");
  assert.equal(count, 30);

  await retryOnBusy(() => fs.unlinkSync(dbPath));
});

console.log("\n全テストを実行しました(node:testのサマリーは標準出力の上部を参照)。");
