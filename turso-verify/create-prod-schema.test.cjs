// create-prod-schema.cjs の単体・統合テスト。実際のTursoには一切接続しない。
// ローカルの一時"file:"DBをTursoの代わりに使い、結果を現在のprisma/dev.dbと比較する。
// 実行方法: node --test create-prod-schema.test.cjs

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { createClient } = require("@libsql/client");
const { DatabaseSync } = require("node:sqlite");

const {
  extractSchemaStatements,
  buildMigrationLedger,
  applySchema,
} = require("./create-prod-schema.cjs");
const { TABLES_IN_FK_ORDER } = require("./turso-restore.cjs");

const DEV_DB_PATH = path.join(__dirname, "..", "prisma", "dev.db");
const MIGRATIONS_DIR = path.join(__dirname, "..", "prisma", "migrations");

function objectsOf(dbPath) {
  const conn = new DatabaseSync(dbPath, { readOnly: true });
  try {
    return conn
      .prepare("SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name")
      .all();
  } finally {
    conn.close();
  }
}

test("extractSchemaStatements: dev.dbから13テーブル全件をFK順で抽出できる", () => {
  const { tableStatements, extraTables } = extractSchemaStatements(DEV_DB_PATH);
  assert.deepEqual(tableStatements.map((t) => t.name), TABLES_IN_FK_ORDER);
  assert.deepEqual(extraTables, []);
  for (const t of tableStatements) {
    assert.match(t.sql, /^CREATE TABLE/);
  }
});

test("buildMigrationLedger: 実際の13件のmigration.sqlからchecksumを計算できる", () => {
  const ledger = buildMigrationLedger(MIGRATIONS_DIR);
  assert.equal(ledger.length, 13);
  for (const entry of ledger) {
    assert.match(entry.checksum, /^[0-9a-f]{64}$/);
    assert.ok(entry.migration_name.length > 0);
  }
});

test("統合: applySchemaで作成したスキーマが、現在のdev.dbのテーブル・インデックス定義と完全一致する", async () => {
  const tmpPath = path.join(os.tmpdir(), `schema-apply-test-${Date.now()}.db`);
  const client = createClient({ url: `file:${tmpPath}` });
  const logs = [];
  try {
    const r = await applySchema({
      client,
      localDbPath: DEV_DB_PATH,
      migrationsDir: MIGRATIONS_DIR,
      log: (m) => logs.push(m),
    });
    assert.equal(r.success, true, logs.join("\n"));
  } finally {
    client.close();
  }

  const created = objectsOf(tmpPath);
  const current = objectsOf(DEV_DB_PATH);
  // _prisma_migrations自体は両方に存在するが、定義文が同一であることも含めて比較する。
  const toMap = (list) => new Map(list.map((o) => [`${o.type}:${o.name}`, o.sql]));
  const createdMap = toMap(created);
  const currentMap = toMap(current);
  assert.deepEqual([...createdMap.keys()].sort(), [...currentMap.keys()].sort());
  for (const key of currentMap.keys()) {
    assert.equal(createdMap.get(key), currentMap.get(key), `定義が不一致: ${key}`);
  }

  // _prisma_migrationsの内容(13件、checksum・形式)を確認する。
  const conn = new DatabaseSync(tmpPath, { readOnly: true });
  const rows = conn.prepare('SELECT id, checksum, migration_name, started_at, finished_at, applied_steps_count, logs, rolled_back_at FROM "_prisma_migrations" ORDER BY started_at').all();
  conn.close();
  assert.equal(rows.length, 13);
  const ledger = buildMigrationLedger(MIGRATIONS_DIR);
  for (let i = 0; i < rows.length; i++) {
    assert.equal(rows[i].migration_name, ledger[i].migration_name);
    assert.equal(rows[i].checksum, ledger[i].checksum);
    assert.equal(rows[i].applied_steps_count, 1);
    assert.equal(rows[i].logs, null);
    assert.equal(rows[i].rolled_back_at, null);
    assert.equal(typeof rows[i].started_at, "number");
    assert.equal(typeof rows[i].finished_at, "number");
    assert.ok(rows[i].finished_at >= rows[i].started_at);
    assert.match(rows[i].id, /^[0-9a-f-]{36}$/);
  }

  for (const suffix of ["", "-wal", "-shm"]) { try { fs.unlinkSync(tmpPath + suffix); } catch {} }
});

test("統合: 作成したスキーマの列構成が、turso-restore.cjsのスキーマ一致チェックを通過する(全テーブルで列名が完全一致)", async () => {
  const tmpPath = path.join(os.tmpdir(), `schema-colcheck-test-${Date.now()}.db`);
  const client = createClient({ url: `file:${tmpPath}` });
  try {
    const r = await applySchema({ client, localDbPath: DEV_DB_PATH, migrationsDir: MIGRATIONS_DIR, log: () => {} });
    assert.equal(r.success, true);
  } finally {
    client.close();
  }

  const createdConn = new DatabaseSync(tmpPath, { readOnly: true });
  const devConn = new DatabaseSync(DEV_DB_PATH, { readOnly: true });
  for (const t of TABLES_IN_FK_ORDER) {
    const createdCols = createdConn.prepare(`PRAGMA table_info("${t}")`).all().map((c) => c.name).sort();
    const devCols = devConn.prepare(`PRAGMA table_info("${t}")`).all().map((c) => c.name).sort();
    assert.deepEqual(createdCols, devCols, `列構成が不一致: ${t}`);
  }
  createdConn.close();
  devConn.close();

  for (const suffix of ["", "-wal", "-shm"]) { try { fs.unlinkSync(tmpPath + suffix); } catch {} }
});

test("統合: 既存オブジェクトがある接続先には何も書き込まず中止する(重複作成防止)", async () => {
  const tmpPath = path.join(os.tmpdir(), `schema-nonempty-test-${Date.now()}.db`);
  const client = createClient({ url: `file:${tmpPath}` });
  try {
    await client.executeMultiple(`CREATE TABLE "Leftover" ("id" TEXT PRIMARY KEY);`);
    const logs = [];
    const r = await applySchema({ client, localDbPath: DEV_DB_PATH, migrationsDir: MIGRATIONS_DIR, log: (m) => logs.push(m) });
    assert.equal(r.success, false);
    assert.equal(r.reason, "target-not-empty");

    const rs = await client.execute("SELECT name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'");
    assert.deepEqual(rs.rows.map((row) => row[0]), ["Leftover"]);
  } finally {
    client.close();
  }
  for (const suffix of ["", "-wal", "-shm"]) { try { fs.unlinkSync(tmpPath + suffix); } catch {} }
});

console.log("\n全テストを実行しました(node:testのサマリーは標準出力の上部を参照)。");
