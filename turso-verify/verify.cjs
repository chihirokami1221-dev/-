// @libsql/client 0.18.0 検証スクリプト。独立環境専用。
// backup-sqlite.cjs / turso-sync-backup.cjs とは完全に独立しており、既存のものには一切触れない。
// 使い方:
//   ローカルのみの検証: node verify.cjs
//   実際のgrowth-os-testへの同期検証: node --env-file=../.env.turso-test.local verify.cjs --sync

const { createClient } = require("@libsql/client");
const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs");
const path = require("node:path");
const { cleanEnvValue, validateCredentials, safeErrorMessage } = require("./env-safety.cjs");

const DIR = __dirname;

function listSiblingFiles(base) {
  const dir = path.dirname(base);
  const name = path.basename(base);
  try {
    return fs.readdirSync(dir).filter((f) => f === name || f.startsWith(name));
  } catch {
    return [];
  }
}

async function retryOnBusy(fn, attempts = 60, delayMs = 1000) {
  for (let i = 0; i < attempts; i++) {
    try {
      return fn();
    } catch (e) {
      if (e.code !== "EBUSY" || i === attempts - 1) throw e;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

function withTimeout(promise, timeoutMs, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`タイムアウト(${timeoutMs}ms): ${label}`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function cleanupAll(base) {
  for (const f of listSiblingFiles(base)) {
    try { await retryOnBusy(() => fs.unlinkSync(path.join(DIR, f))); } catch {}
  }
}

// --- 1. ローカルのみ: ファイル作成・読み込み・close後の挙動 ---
async function testLocalOnly() {
  const dbPath = path.join(DIR, "verify-local.tmp.db");
  await cleanupAll(dbPath);

  const client = createClient({ url: `file:${dbPath}` });
  await client.executeMultiple(`CREATE TABLE "Memo" ("id" TEXT PRIMARY KEY, "v" TEXT);`);
  for (let i = 0; i < 20; i++) {
    await client.execute({ sql: `INSERT INTO "Memo" (id, v) VALUES (?, ?)`, args: [`m${i}`, `value-${i}`] });
  }
  console.log("close()直前のファイル一覧: " + JSON.stringify(listSiblingFiles(dbPath)));
  client.close();

  const sqliteDb = new DatabaseSync(dbPath, { readOnly: true });
  const integrity = sqliteDb.prepare("PRAGMA integrity_check").get().integrity_check;
  const count = sqliteDb.prepare(`SELECT COUNT(*) as c FROM "Memo"`).get().c;
  sqliteDb.close();

  console.log("node:sqliteでの読み取り: integrity=" + integrity + ", count=" + count);
  const ok = integrity === "ok" && count === 20;
  console.log("RESULT(ローカルのみ)=" + (ok ? "OK" : "NG"));

  await cleanupAll(dbPath);
  return ok;
}

// --- 2. 実際のTursoへのEmbedded Replica同期(--syncフラグ指定時のみ) ---
async function testRealSync() {
  const url = cleanEnvValue(process.env.TURSO_TEST_DATABASE_URL);
  const token = cleanEnvValue(process.env.TURSO_TEST_READONLY_TOKEN);
  if (!url || !token) {
    console.log("RESULT(実同期)=SKIPPED(環境変数未設定)");
    return null;
  }
  const credCheck = validateCredentials(url, token);
  if (!credCheck.ok) {
    console.log("RESULT(実同期)=FAILURE");
    console.log(credCheck.reason);
    return false;
  }

  const replicaPath = path.join(DIR, "verify-replica.tmp.db");
  const snapshotPath = path.join(DIR, "verify-snapshot.tmp.db");
  await cleanupAll(replicaPath);
  try { fs.unlinkSync(snapshotPath); } catch {}

  // リモート直結で件数を取得(書き込みなし、SELECTのみ)。
  // ここでのエラーは、値を含まない形に変換してから呼び出し元へ伝える
  // (この関数の外へ生のエラーを一切漏らさない)。
  const directClient = createClient({ url, authToken: token });
  const TABLES = [
    "Category", "Event", "RoadmapItem", "KeyAction", "IndividualGoal",
    "DiaryEntry", "Achievement", "AchievementAxisLink", "TodayTask",
    "WeeklyTodoItem", "MarketValueScoreSnapshot", "MarketDataEntry", "Memo",
  ];
  const remoteCounts = {};
  try {
    for (const t of TABLES) {
      try {
        const rs = await withTimeout(directClient.execute(`SELECT COUNT(*) as c FROM "${t}"`), 20000, `件数取得(${t})`);
        remoteCounts[t] = Number(rs.rows[0].c);
      } catch (e) {
        if (/no such table/i.test(e.message)) { remoteCounts[t] = null; continue; }
        throw new Error(safeErrorMessage(e, [url, token]));
      }
    }
    console.log("リモート直結での件数取得: OK");
  } catch (e) {
    console.log("RESULT(実同期)=FAILURE");
    console.log("リモート直結での件数取得に失敗しました: " + safeErrorMessage(e, [url, token]));
    await cleanupAll(replicaPath);
    return false;
  } finally {
    try { directClient.close(); } catch {}
  }

  // Embedded Replicaへ同期する。
  let replicaClient;
  try {
    replicaClient = createClient({ url: `file:${replicaPath}`, syncUrl: url, authToken: token });
    await withTimeout(replicaClient.sync(), 30000, "Embedded Replica同期");
    console.log("Embedded Replicaへの同期: OK(0.18.0で成功しました)");
  } catch (e) {
    console.log("RESULT(実同期)=FAILURE");
    console.log("同期エラー: " + safeErrorMessage(e, [url, token]));
    try { if (replicaClient) replicaClient.close(); } catch {}
    await cleanupAll(replicaPath);
    return false;
  } finally {
    try { if (replicaClient) replicaClient.close(); } catch {}
  }

  // クローズ後、本体+付随ファイルを別名でコピーして独立したスナップショットとする。
  await retryOnBusy(() => {
    const dir = path.dirname(replicaPath);
    const base = path.basename(replicaPath);
    const destBase = path.basename(snapshotPath);
    for (const entry of fs.readdirSync(dir)) {
      if (entry === base) fs.copyFileSync(path.join(dir, entry), snapshotPath);
      else if (entry.startsWith(base)) fs.copyFileSync(path.join(dir, entry), path.join(dir, destBase + entry.slice(base.length)));
    }
  });
  console.log("クローズ後のレプリカをスナップショットへコピー: OK");

  const snapDb = new DatabaseSync(snapshotPath, { readOnly: true });
  const integrity = snapDb.prepare("PRAGMA integrity_check").get().integrity_check;
  const localCounts = {};
  for (const t of TABLES) {
    try {
      localCounts[t] = snapDb.prepare(`SELECT COUNT(*) as c FROM "${t}"`).get().c;
    } catch {
      localCounts[t] = null;
    }
  }
  snapDb.close();

  console.log("スナップショットのintegrity_check: " + integrity);
  let allMatch = true;
  for (const t of TABLES) {
    const match = remoteCounts[t] === localCounts[t];
    console.log(`  ${t}: remote=${remoteCounts[t]}, local=${localCounts[t]} (${match ? "OK" : "NG"})`);
    if (!match) allMatch = false;
  }

  const ok = integrity === "ok" && allMatch;
  console.log("RESULT(実同期)=" + (ok ? "SUCCESS" : "FAILURE"));

  await cleanupAll(replicaPath);
  await cleanupAll(snapshotPath);
  return ok;
}

async function main() {
  const localOk = await testLocalOnly();
  const syncResult = process.argv.includes("--sync") ? await testRealSync() : "NOT_REQUESTED";
  console.log("\n=== 総合結果 ===");
  console.log("ローカルのみ: " + (localOk ? "OK" : "NG"));
  console.log("実同期: " + syncResult);
}

main().catch((e) => {
  // ここに到達する時点で、url/tokenを含むエラーはtestRealSync内で既に安全な形に
  // 変換されているはずだが、万一に備えてここでも再度除去する。
  const url = cleanEnvValue(process.env.TURSO_TEST_DATABASE_URL);
  const token = cleanEnvValue(process.env.TURSO_TEST_READONLY_TOKEN);
  console.log("想定外のエラー: " + safeErrorMessage(e, [url, token]));
  process.exitCode = 1;
});
