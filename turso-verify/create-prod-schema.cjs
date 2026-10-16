// 成長OS: 空のTurso本番DBに、ローカルSQLite(prisma/dev.db)と同一のスキーマを作成し、
// Prismaのマイグレーション履歴(_prisma_migrations)を正しい状態で記録するスクリプト。
//
// 重要な前提(実機検証で確認済み): prisma/migrations配下の13件のmigration.sqlを
// そのまま順番に再生しても、現在のdev.dbのスキーマとは一致しない(一部の変更が
// `prisma db push`で行われ、migration.sqlには反映されていないため)。
// そのため、テーブル・インデックスの実際の作成には、13件のファイルを再生するのではなく、
// 現在のdev.db自身のsqlite_master(その時点で動いている正本のスキーマ)から
// CREATE TABLE/CREATE INDEX文をそのまま抽出して使う。
// 一方、_prisma_migrationsへの記録(migration_name・checksum)は、将来Prismaの
// 通常のマイグレーションワークフローに正しく認識されるよう、13件のmigration.sqlファイルの
// 内容から計算したchecksum(sha256。Prismaと同一の算出方法であることを実機で確認済み)を使う
// (「このDBにはこの13件が既に適用されている」という履歴だけを記録する。SQLの再実行はしない)。
//
// 安全設計の要点:
// - 接続先が空(テーブル・インデックスが1つも無い)であることを確認してからのみ実行する。
//   1つでも既存オブジェクトがあれば、何も書き込まず中止する(重複作成・衝突を防ぐ)。
// - 接続エラーは固定の安全なメッセージのみを出力する(ライブラリの生エラー文字列や
//   スタックトレースは一切出力しない)。認証情報の値も一切出力しない。
// - このスクリプトは「空のDBへのスキーマ作成」専用であり、データのINSERTは一切行わない
//   (データ移行はturso-restore.cjsが別途担当する)。

const { createClient } = require("@libsql/client");
const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { cleanEnvValue, validateCredentials } = require("./env-safety.cjs");
const { TABLES_IN_FK_ORDER } = require("./turso-restore.cjs");

const CONNECT_FAIL_MSG = "接続または問い合わせに失敗しました(安全のため詳細は表示しません)。";

// Prisma自身が作る_prisma_migrationsテーブルの定義(dev.dbから読み取り専用で確認した
// 実際のCREATE TABLE文と同一)。
const PRISMA_MIGRATIONS_TABLE_SQL = `CREATE TABLE "_prisma_migrations" (
    "id"                    TEXT PRIMARY KEY NOT NULL,
    "checksum"              TEXT NOT NULL,
    "finished_at"           DATETIME,
    "migration_name"        TEXT NOT NULL,
    "logs"                  TEXT,
    "rolled_back_at"        DATETIME,
    "started_at"            DATETIME NOT NULL DEFAULT current_timestamp,
    "applied_steps_count"   INTEGER UNSIGNED NOT NULL DEFAULT 0
)`;

function withTimeout(promise, timeoutMs, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`タイムアウト(${timeoutMs}ms): ${label}`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// 現在のローカルSQLite(localDbPath)から、テーブル・インデックスのCREATE文をそのまま抽出する。
// 戻り値: { tableStatements: [{name, sql}], indexStatements: [{name, sql}], extraTables: string[] }
function extractSchemaStatements(localDbPath) {
  const conn = new DatabaseSync(localDbPath, { readOnly: true });
  let objects;
  try {
    objects = conn
      .prepare(
        "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name != '_prisma_migrations'"
      )
      .all();
  } finally {
    conn.close();
  }

  const tableByName = new Map(objects.filter((o) => o.type === "table").map((o) => [o.name, o.sql]));
  const indexes = objects.filter((o) => o.type === "index");

  const tableStatements = [];
  for (const t of TABLES_IN_FK_ORDER) {
    if (tableByName.has(t)) {
      tableStatements.push({ name: t, sql: tableByName.get(t) });
      tableByName.delete(t);
    }
  }
  const extraTables = [...tableByName.keys()];

  const indexOrder = (tblName) => {
    const i = TABLES_IN_FK_ORDER.indexOf(tblName);
    return i === -1 ? TABLES_IN_FK_ORDER.length : i;
  };
  const indexStatements = indexes
    .slice()
    .sort((a, b) => indexOrder(a.tbl_name) - indexOrder(b.tbl_name) || a.name.localeCompare(b.name))
    .map((o) => ({ name: o.name, sql: o.sql }));

  return { tableStatements, indexStatements, extraTables };
}

// prisma/migrations配下の全マイグレーションファイルから、適用順序とchecksum(sha256)を読み取る。
function buildMigrationLedger(migrationsDir) {
  const dirs = fs
    .readdirSync(migrationsDir)
    .filter((d) => fs.statSync(path.join(migrationsDir, d)).isDirectory())
    .sort();
  return dirs.map((name) => {
    const content = fs.readFileSync(path.join(migrationsDir, name, "migration.sql"));
    const checksum = crypto.createHash("sha256").update(content).digest("hex");
    return { migration_name: name, checksum };
  });
}

// 接続先に既存オブジェクト(テーブル・インデックス等)が1つも無いことを確認する。
async function verifyTargetHasNoObjects(client, timeoutMs = 20000) {
  const rs = await withTimeout(
    client.execute("SELECT name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'"),
    timeoutMs,
    "既存オブジェクト確認"
  );
  return rs.rows.map((r) => r[0]);
}

// config: { client, localDbPath, migrationsDir, log }
// 戻り値: { success, reason }
async function applySchema(config) {
  const log = config.log || ((...args) => console.log(...args));
  const client = config.client;
  const timeoutMs = config.timeoutMs || 20000;

  let existing;
  try {
    existing = await verifyTargetHasNoObjects(client, timeoutMs);
  } catch {
    log("RESULT=FAILURE");
    log(CONNECT_FAIL_MSG);
    return { success: false, reason: "connect-failed" };
  }
  if (existing.length > 0) {
    log("RESULT=FAILURE");
    log("接続先に既存オブジェクトがあるため中止します(既存データ保護): " + existing.join(", "));
    return { success: false, reason: "target-not-empty" };
  }
  log("接続先が完全に空であることを確認: OK");

  const { tableStatements, indexStatements, extraTables } = extractSchemaStatements(config.localDbPath);
  if (extraTables.length > 0) {
    log("RESULT=FAILURE");
    log("ローカルSQLiteに想定外のテーブルがあるため中止します: " + extraTables.join(", "));
    return { success: false, reason: "unexpected-local-tables" };
  }
  if (tableStatements.length !== TABLES_IN_FK_ORDER.length) {
    log("RESULT=FAILURE");
    log(`ローカルSQLiteのテーブル数が想定(${TABLES_IN_FK_ORDER.length})と異なります(${tableStatements.length})。`);
    return { success: false, reason: "unexpected-table-count" };
  }

  try {
    for (const { name, sql } of tableStatements) {
      await withTimeout(client.execute(sql), timeoutMs, `CREATE TABLE(${name})`);
    }
    log(`テーブル作成: OK(${tableStatements.length}件)`);

    for (const { name, sql } of indexStatements) {
      await withTimeout(client.execute(sql), timeoutMs, `CREATE INDEX(${name})`);
    }
    log(`インデックス作成: OK(${indexStatements.length}件)`);

    await withTimeout(client.execute(PRISMA_MIGRATIONS_TABLE_SQL), timeoutMs, "CREATE TABLE(_prisma_migrations)");
    log("_prisma_migrationsテーブル作成: OK");
  } catch {
    log("RESULT=FAILURE");
    log("スキーマ作成中に" + CONNECT_FAIL_MSG);
    log("本番DBにスキーマが部分的に作成された可能性があります。手動確認のうえ、必要であれば接続先DBを削除して作り直してください(このスクリプトの再実行は、空のDBに対してのみ行えます)。");
    return { success: false, reason: "schema-creation-failed" };
  }

  const ledger = buildMigrationLedger(config.migrationsDir);
  try {
    const statements = ledger.map(({ migration_name, checksum }) => {
      const now = Date.now();
      return {
        sql: `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES (?, ?, ?, ?, NULL, NULL, ?, 1)`,
        args: [crypto.randomUUID(), checksum, now, migration_name, now],
      };
    });
    await withTimeout(client.batch(statements, "write"), timeoutMs, "_prisma_migrations記録");
    log(`_prisma_migrationsへの履歴記録: OK(${ledger.length}件)`);
  } catch {
    log("RESULT=FAILURE");
    log("_prisma_migrationsへの履歴記録中に" + CONNECT_FAIL_MSG);
    log("テーブル・インデックスの作成自体は完了していますが、履歴記録だけが失敗しています。手動確認が必要です。");
    return { success: false, reason: "ledger-write-failed" };
  }

  log("RESULT=SUCCESS");
  return { success: true, reason: null };
}

module.exports = {
  extractSchemaStatements,
  buildMigrationLedger,
  verifyTargetHasNoObjects,
  applySchema,
  PRISMA_MIGRATIONS_TABLE_SQL,
};

if (require.main === module) {
  const expectedHostSubstring = process.argv[2];
  const url = cleanEnvValue(process.env.TURSO_PROD_WRITE_DATABASE_URL);
  const token = cleanEnvValue(process.env.TURSO_PROD_WRITE_AUTH_TOKEN);

  (async () => {
    if (!expectedHostSubstring) {
      console.log("RESULT=FAILURE");
      console.log("誤接続防止のため、第1引数に接続先ホスト名に含まれるべき文字列(例: growth-os-prod)を指定してください。");
      process.exitCode = 1;
      return;
    }
    const credCheck = validateCredentials(url, token);
    if (!credCheck.ok) {
      console.log("RESULT=FAILURE");
      console.log(credCheck.reason);
      process.exitCode = 1;
      return;
    }
    let hostname;
    try {
      hostname = new URL(url).hostname;
    } catch {
      console.log("RESULT=FAILURE");
      console.log(CONNECT_FAIL_MSG);
      process.exitCode = 1;
      return;
    }
    if (!hostname.includes(expectedHostSubstring)) {
      console.log("RESULT=FAILURE");
      console.log("接続先ホスト名が指定文字列と一致しないため、接続せず中止します(誤接続防止)。");
      process.exitCode = 1;
      return;
    }

    const client = createClient({ url, authToken: token });
    try {
      const r = await applySchema({
        client,
        localDbPath: path.join(__dirname, "..", "prisma", "dev.db"),
        migrationsDir: path.join(__dirname, "..", "prisma", "migrations"),
      });
      process.exitCode = r.success ? 0 : 1;
    } finally {
      try { client.close(); } catch {}
    }
  })();
}
