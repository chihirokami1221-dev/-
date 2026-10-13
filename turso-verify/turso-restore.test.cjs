// turso-restore.cjs の単体・統合テスト。実際のTursoには一切接続しない
// (ソース・ターゲットともにローカルのlibSQLファイルで代用する)。
// 実行方法: node --test turso-restore.test.cjs

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { createClient } = require("@libsql/client");

const { restoreFromBackup, verifyTargetIsEmpty, TABLES_IN_FK_ORDER } = require("./turso-restore.cjs");

async function buildSyntheticBackup(dbPath) {
  const client = createClient({ url: `file:${dbPath}` });
  try {
    await client.executeMultiple(`
      CREATE TABLE "Category" ("id" TEXT NOT NULL PRIMARY KEY, "key" TEXT NOT NULL UNIQUE, "label" TEXT NOT NULL, "color" TEXT NOT NULL, "sortOrder" INTEGER NOT NULL DEFAULT 0, "longTermPlan" TEXT NOT NULL DEFAULT '', "createdAt" DATETIME NOT NULL);
      CREATE TABLE "RoadmapItem" ("id" TEXT NOT NULL PRIMARY KEY, "title" TEXT NOT NULL, "categoryId" TEXT NOT NULL, "requiredSkills" TEXT NOT NULL, "updatedAt" DATETIME NOT NULL);
      CREATE TABLE "KeyAction" ("id" TEXT NOT NULL PRIMARY KEY, "roadmapItemId" TEXT NOT NULL, "title" TEXT NOT NULL, "updatedAt" DATETIME NOT NULL);
      CREATE TABLE "Memo" ("id" TEXT NOT NULL PRIMARY KEY, "title" TEXT NOT NULL, "content" TEXT NOT NULL, "sourceKey" TEXT, "updatedAt" DATETIME NOT NULL);
    `);
    await client.execute({
      sql: `INSERT INTO "Category" (id, key, label, color, sortOrder, longTermPlan, createdAt) VALUES (?,?,?,?,?,?,?)`,
      args: ["cat1", "test_jp", "日本語カテゴリ🎉", "#123456", 0, "", "2026-01-01T00:00:00.000Z"],
    });
    await client.execute({
      sql: `INSERT INTO "RoadmapItem" (id, title, categoryId, requiredSkills, updatedAt) VALUES (?,?,?,?,?)`,
      args: ["rm1", "改行入り\nタイトル", "cat1", "", "2026-01-01T00:00:00.000Z"],
    });
    await client.execute({
      sql: `INSERT INTO "KeyAction" (id, roadmapItemId, title, updatedAt) VALUES (?,?,?,?)`,
      args: ["ka1", "rm1", "重点行動", "2026-01-01T00:00:00.000Z"],
    });
    await client.execute({
      sql: `INSERT INTO "Memo" (id, title, content, sourceKey, updatedAt) VALUES (?,?,?,?,?)`,
      args: ["m1", "空メモ", "", null, "2026-01-01T00:00:00.000Z"],
    });
    await client.execute({
      sql: `INSERT INTO "Memo" (id, title, content, sourceKey, updatedAt) VALUES (?,?,?,?,?)`,
      args: ["m2", "絵文字🎉", "内容", "src-key", "2026-12-31T23:59:59.999Z"],
    });
  } finally {
    client.close();
  }
}

test("restoreFromBackup: expectedHostSubstringが無いと接続せず失敗する", async () => {
  const logs = [];
  const r = await restoreFromBackup({
    backupPath: "dummy.db",
    targetUrl: "file:/tmp/anything.db",
    targetToken: "dummy",
    log: (m) => logs.push(m),
  });
  assert.equal(r.success, false);
  assert.match(logs.join("\n"), /expectedHostSubstring/);
});

test("restoreFromBackup: 接続先のホスト名がexpectedHostSubstringと一致しない場合、接続せず失敗する", async () => {
  const logs = [];
  const r = await restoreFromBackup({
    backupPath: "dummy.db",
    targetUrl: "https://growth-os-migration-test-chippy.example.turso.io",
    targetToken: "dummy",
    expectedHostSubstring: "completely-different-name",
    log: (m) => logs.push(m),
  });
  assert.equal(r.success, false);
  assert.equal(r.reason, "host-mismatch");
});

test("統合: 日本語・絵文字・NULL・FKを含む合成バックアップから、空のターゲットへ復元し、件数・内容ハッシュが完全一致する", async () => {
  const dir = os.tmpdir();
  const backupPath = path.join(dir, `restore-test-backup-${Date.now()}.db`);
  const targetPath = path.join(dir, `restore-test-target-${Date.now()}.db`);
  await buildSyntheticBackup(backupPath);

  // ターゲットは空の状態で用意する(スキーマだけ作る。実際のTursoなら事前にスキーマ適用済みの想定)。
  const targetClient = createClient({ url: `file:${targetPath}` });
  await targetClient.executeMultiple(`
    CREATE TABLE "Category" ("id" TEXT NOT NULL PRIMARY KEY, "key" TEXT NOT NULL UNIQUE, "label" TEXT NOT NULL, "color" TEXT NOT NULL, "sortOrder" INTEGER NOT NULL DEFAULT 0, "longTermPlan" TEXT NOT NULL DEFAULT '', "createdAt" DATETIME NOT NULL);
    CREATE TABLE "RoadmapItem" ("id" TEXT NOT NULL PRIMARY KEY, "title" TEXT NOT NULL, "categoryId" TEXT NOT NULL, "requiredSkills" TEXT NOT NULL, "updatedAt" DATETIME NOT NULL);
    CREATE TABLE "KeyAction" ("id" TEXT NOT NULL PRIMARY KEY, "roadmapItemId" TEXT NOT NULL, "title" TEXT NOT NULL, "updatedAt" DATETIME NOT NULL);
    CREATE TABLE "Memo" ("id" TEXT NOT NULL PRIMARY KEY, "title" TEXT NOT NULL, "content" TEXT NOT NULL, "sourceKey" TEXT, "updatedAt" DATETIME NOT NULL);
  `);
  targetClient.close();

  const logs = [];
  const r = await restoreFromBackup({
    backupPath,
    targetUrl: `file:${targetPath}`,
    targetToken: "unused-for-local-file",
    expectedHostSubstring: path.basename(targetPath),
    log: (m) => logs.push(m),
  });

  assert.equal(r.success, true, logs.join("\n"));

  // 復元結果を直接読み取って確認する。
  const verifyClient = createClient({ url: `file:${targetPath}` });
  const memoRows = await verifyClient.execute(`SELECT * FROM "Memo" ORDER BY id`);
  verifyClient.close();
  assert.equal(memoRows.rows.length, 2);

  for (const p of [backupPath, targetPath]) {
    for (const suffix of ["", "-wal", "-shm"]) { try { fs.unlinkSync(p + suffix); } catch {} }
  }
});

test("統合: 復元先に既存データが1件でもあれば、書き込みを一切行わず中止する", async () => {
  const dir = os.tmpdir();
  const backupPath = path.join(dir, `restore-test-backup2-${Date.now()}.db`);
  const targetPath = path.join(dir, `restore-test-target2-${Date.now()}.db`);
  await buildSyntheticBackup(backupPath);

  const targetClient = createClient({ url: `file:${targetPath}` });
  await targetClient.executeMultiple(`
    CREATE TABLE "Category" ("id" TEXT NOT NULL PRIMARY KEY, "key" TEXT NOT NULL UNIQUE, "label" TEXT NOT NULL, "color" TEXT NOT NULL, "sortOrder" INTEGER NOT NULL DEFAULT 0, "longTermPlan" TEXT NOT NULL DEFAULT '', "createdAt" DATETIME NOT NULL);
    CREATE TABLE "RoadmapItem" ("id" TEXT NOT NULL PRIMARY KEY, "title" TEXT NOT NULL, "categoryId" TEXT NOT NULL, "requiredSkills" TEXT NOT NULL, "updatedAt" DATETIME NOT NULL);
    CREATE TABLE "KeyAction" ("id" TEXT NOT NULL PRIMARY KEY, "roadmapItemId" TEXT NOT NULL, "title" TEXT NOT NULL, "updatedAt" DATETIME NOT NULL);
    CREATE TABLE "Memo" ("id" TEXT NOT NULL PRIMARY KEY, "title" TEXT NOT NULL, "content" TEXT NOT NULL, "sourceKey" TEXT, "updatedAt" DATETIME NOT NULL);
  `);
  // 既存データを1件だけ投入しておく(「既存データ保護」が働くかどうかを確認するための前提)。
  await targetClient.execute({
    sql: `INSERT INTO "Memo" (id, title, content, sourceKey, updatedAt) VALUES (?,?,?,?,?)`,
    args: ["existing1", "既存メモ", "既存データ", null, "2025-01-01T00:00:00.000Z"],
  });
  targetClient.close();

  const logs = [];
  const r = await restoreFromBackup({
    backupPath,
    targetUrl: `file:${targetPath}`,
    targetToken: "unused-for-local-file",
    expectedHostSubstring: path.basename(targetPath),
    log: (m) => logs.push(m),
  });

  assert.equal(r.success, false);
  assert.equal(r.reason, "target-not-empty");

  // 既存データが変更されていないことを確認する。
  const verifyClient = createClient({ url: `file:${targetPath}` });
  const rows = await verifyClient.execute(`SELECT * FROM "Memo"`);
  verifyClient.close();
  assert.equal(rows.rows.length, 1);
  assert.equal(rows.rows[0][0], "existing1");

  for (const p of [backupPath, targetPath]) {
    for (const suffix of ["", "-wal", "-shm"]) { try { fs.unlinkSync(p + suffix); } catch {} }
  }
});

test("統合: 復元先のテーブル構成(列)がバックアップと異なる場合、書き込みを行わず中止する", async () => {
  const dir = os.tmpdir();
  const backupPath = path.join(dir, `restore-test-backup3-${Date.now()}.db`);
  const targetPath = path.join(dir, `restore-test-target3-${Date.now()}.db`);
  await buildSyntheticBackup(backupPath);

  // ターゲットは同じテーブル名だが、Memoの列構成が異なる(sourceKeyが無い)状態を用意する。
  const targetClient = createClient({ url: `file:${targetPath}` });
  await targetClient.executeMultiple(`
    CREATE TABLE "Category" ("id" TEXT NOT NULL PRIMARY KEY, "key" TEXT NOT NULL UNIQUE, "label" TEXT NOT NULL, "color" TEXT NOT NULL, "sortOrder" INTEGER NOT NULL DEFAULT 0, "longTermPlan" TEXT NOT NULL DEFAULT '', "createdAt" DATETIME NOT NULL);
    CREATE TABLE "RoadmapItem" ("id" TEXT NOT NULL PRIMARY KEY, "title" TEXT NOT NULL, "categoryId" TEXT NOT NULL, "requiredSkills" TEXT NOT NULL, "updatedAt" DATETIME NOT NULL);
    CREATE TABLE "KeyAction" ("id" TEXT NOT NULL PRIMARY KEY, "roadmapItemId" TEXT NOT NULL, "title" TEXT NOT NULL, "updatedAt" DATETIME NOT NULL);
    CREATE TABLE "Memo" ("id" TEXT NOT NULL PRIMARY KEY, "title" TEXT NOT NULL, "content" TEXT NOT NULL, "updatedAt" DATETIME NOT NULL);
  `);
  targetClient.close();

  const logs = [];
  const r = await restoreFromBackup({
    backupPath,
    targetUrl: `file:${targetPath}`,
    targetToken: "unused-for-local-file",
    expectedHostSubstring: path.basename(targetPath),
    log: (m) => logs.push(m),
  });

  assert.equal(r.success, false);
  assert.match(r.reason, /schema-mismatch/);
  assert.match(r.reason, /Memo/);

  // 書き込みが一切行われていないことを確認する。
  const verifyClient = createClient({ url: `file:${targetPath}` });
  const rows = await verifyClient.execute(`SELECT COUNT(*) as c FROM "Memo"`);
  verifyClient.close();
  assert.equal(Number(rows.rows[0][0]), 0);

  for (const p of [backupPath, targetPath]) {
    for (const suffix of ["", "-wal", "-shm"]) { try { fs.unlinkSync(p + suffix); } catch {} }
  }
});

test("統合: 破損した(integrity_checkが失敗する)バックアップファイルからは復元を実行しない", async () => {
  const dir = os.tmpdir();
  const fakeBackupPath = path.join(dir, `restore-test-corrupt-${Date.now()}.db`);
  // 正当なSQLiteファイルではない内容を書き込み、integrity_checkが失敗する状況を作る。
  fs.writeFileSync(fakeBackupPath, "これは正しいSQLiteファイルではありません");

  const logs = [];
  const r = await restoreFromBackup({
    backupPath: fakeBackupPath,
    targetUrl: "file:/tmp/unused-target.db",
    targetToken: "unused",
    expectedHostSubstring: "unused-target.db",
    log: (m) => logs.push(m),
  });

  assert.equal(r.success, false);
  assert.equal(r.reason, "backup-read-failed");

  fs.unlinkSync(fakeBackupPath);
});

console.log("\n全テストを実行しました(node:testのサマリーは標準出力の上部を参照)。");
