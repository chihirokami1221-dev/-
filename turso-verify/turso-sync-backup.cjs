// 成長OS: Turso(libSQL) Embedded Replicasを使った読み取り専用バックアップスクリプト。
// この独立環境(turso-verify/)の@libsql/client@0.18.0を使う(メインアプリのnode_modules/
// package.jsonとは無関係。Node.jsのrequire解決は、このファイル自身のディレクトリから
// 上方向に探索するため、ここに置くだけで0.18.0が解決される)。
// backup-sqlite.cjsとは完全に独立しており、既存のスクリプト・手順書には一切変更を加えない。
//
// 安全設計の要点:
// - 同期中のEmbedded Replicaファイルは、Turso公式ドキュメントが明示的に警告している通り
//   「同期中に別の接続で開くとデータ破損の可能性がある」ため、"sync()→close()"を完全に終えた
//   後に限り、ファイルを別の場所へコピーしてから、そのコピーだけを検証する。
// - リモート側は、Embedded Replica接続とは別の「直結」接続で、件数だけでなく各行の内容ハッシュも
//   取得し、ローカルスナップショットと比較する(件数一致だけでは、同じ件数で内容が違う場合を
//   検知できないため)。
// - 対象DB・トークンは環境変数でのみ受け取り、ソースコードに書かない。ログにも値を出力しない。
//
// 使い方(実際の検証用DBに対して。このフォルダ内から実行する):
//   node --env-file=../.env.turso-test.local turso-sync-backup.cjs

const { createClient } = require("@libsql/client");
const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const TABLES = [
  "Category", "Event", "RoadmapItem", "KeyAction", "IndividualGoal",
  "DiaryEntry", "Achievement", "AchievementAxisLink", "TodayTask",
  "WeeklyTodoItem", "MarketValueScoreSnapshot", "MarketDataEntry", "Memo",
];

const DEFAULT_BACKUP_DIR = "C:\\Users\\chihiro\\AppData\\Local\\GrowthOSBackups\\turso-sync";

function canonicalValue(value) {
  if (value === null) return "\u0000NULL\u0000";
  if (value instanceof ArrayBuffer) return "\u0000BLOB:" + Buffer.from(value).toString("hex") + "\u0000";
  return JSON.stringify(value);
}

function rowHash(row, columns) {
  return crypto.createHash("sha256").update(columns.map((c) => `${c}=${canonicalValue(row[c])}`).join("\u0001"), "utf8").digest("hex");
}

function sortedHashes(rows, columns, idCol) {
  return rows.map((r) => ({ id: r[idCol], hash: rowHash(r, columns) })).sort((a, b) => (a.id > b.id ? 1 : a.id < b.id ? -1 : 0));
}

// node:sqlite(DatabaseSync, readOnly)でローカルファイルを検証する(Embedded Replicaの
// 「同期完了・クローズ済みのスナップショット」専用。同期中の元ファイルには使わない)。
function snapshotLocalFile(filePath) {
  const conn = new DatabaseSync(filePath, { readOnly: true });
  try {
    const integrity = conn.prepare("PRAGMA integrity_check").get().integrity_check;
    const counts = {};
    const hashes = {};
    for (const t of TABLES) {
      let cols, rows;
      try {
        cols = conn.prepare(`PRAGMA table_info("${t}")`).all().map((c) => c.name);
        rows = conn.prepare(`SELECT * FROM "${t}"`).all();
      } catch {
        counts[t] = null;
        hashes[t] = null;
        continue;
      }
      counts[t] = rows.length;
      const idCol = cols.includes("id") ? "id" : cols[0];
      hashes[t] = sortedHashes(rows, cols, idCol);
    }
    return { integrity, counts, hashes };
  } finally {
    conn.close();
  }
}

function isMissingTableError(e) {
  const msg = String((e && e.message) || "");
  return /no such table/i.test(msg);
}

function withTimeout(promise, timeoutMs, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`タイムアウト(${timeoutMs}ms): ${label}`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// リモートに直結(Embedded Replicaではない、syncUrl無し)した接続で、各テーブルの件数と
// 内容ハッシュを読み取り専用で取得する(SELECTのみ発行)。接続自体ができない場合は、
// テーブル単位でリトライし続けず、最初のエラーで即座に失敗させる。
async function fetchRemoteSnapshot(remoteUrl, authToken, timeoutMs = 20000) {
  const client = createClient({ url: remoteUrl, authToken });
  try {
    const counts = {};
    const hashes = {};
    for (const t of TABLES) {
      try {
        const rs = await withTimeout(client.execute(`SELECT * FROM "${t}"`), timeoutMs, `リモート取得(${t})`);
        const cols = rs.columns;
        const rows = rs.rows.map((r) => {
          const obj = {};
          cols.forEach((c, i) => { obj[c] = r[i]; });
          return obj;
        });
        counts[t] = rows.length;
        const idCol = cols.includes("id") ? "id" : cols[0];
        hashes[t] = sortedHashes(rows, cols, idCol);
      } catch (e) {
        if (isMissingTableError(e)) {
          counts[t] = null;
          hashes[t] = null;
          continue;
        }
        throw e;
      }
    }
    return { counts, hashes };
  } finally {
    client.close();
  }
}

// 件数・ハッシュ・整合性から成功/失敗を判定する。
function decideSuccess(remoteSnapshot, localSnapshot) {
  if (localSnapshot.integrity !== "ok") {
    return { success: false, reason: "integrity_checkがokではありません: " + localSnapshot.integrity };
  }
  const mismatches = [];
  for (const t of TABLES) {
    const rCount = remoteSnapshot.counts[t];
    const lCount = localSnapshot.counts[t];
    if (rCount !== lCount) {
      mismatches.push(`${t}(件数不一致 remote=${rCount}, local=${lCount})`);
      continue;
    }
    const rHash = JSON.stringify(remoteSnapshot.hashes[t]);
    const lHash = JSON.stringify(localSnapshot.hashes[t]);
    if (rHash !== lHash) {
      mismatches.push(`${t}(内容ハッシュ不一致)`);
    }
  }
  if (mismatches.length > 0) {
    return { success: false, reason: "一致しないテーブルがあります: " + mismatches.join(", ") };
  }
  return { success: true, reason: null };
}

function reserveFile(filePath) {
  let fd;
  try {
    fd = fs.openSync(filePath, "wx");
  } catch (e) {
    if (e.code === "EEXIST") return { ok: false, reason: "ファイルが既に存在します: " + filePath };
    return { ok: false, reason: "ファイルを確保できませんでした(" + filePath + "): " + e.message.split("\n")[0] };
  }
  fs.closeSync(fd);
  return { ok: true };
}

// スナップショットのコピー(本体+WAL+SHM等)を、書き込み可能で開いてチェックポイントし、
// WAL上の未反映データを本体ファイルへ完全に統合する。これにより「本体ファイル1つだけで
// 内容を再現できる」状態になる(実機テストで、実際の同期時にWALファイルへ約688KBの
// データが書き込まれることを確認したため、本体ファイルだけのコピーでは不十分な可能性があった)。
// チェックポイント後、空になった付随ファイル(-wal, -shm等)は削除し、本体ファイルのみ残す。
// 対象はスナップショット(自分のコピー)のみで、元のレプリカ・リモートには一切触れない。
async function consolidateSnapshot(snapshotPath) {
  const writable = new DatabaseSync(snapshotPath);
  try {
    writable.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    // チェックポイントだけでは-shmファイルが残ることを実機で確認した(-walは0バイトに
    // truncateされるが、-shmは固定サイズの共有メモリ構造のため縮小されない)。
    // WALモード自体から抜ける(DELETEモードへ切り替える)と、SQLiteの仕様により
    // -wal/-shmファイルそのものが削除される。
    writable.exec("PRAGMA journal_mode=DELETE");
  } finally {
    writable.close();
  }
  const dir = path.dirname(snapshotPath);
  const base = path.basename(snapshotPath);
  const failed = [];
  for (const entry of fs.readdirSync(dir)) {
    if (entry !== base && entry.startsWith(base)) {
      // close()直後はWindowsでファイルがロックされたままの場合があるため(実機で再発を確認)、
      // retryOnBusyで待機してから削除する。
      try {
        await retryOnBusy(() => fs.unlinkSync(path.join(dir, entry)));
      } catch {
        failed.push(path.join(dir, entry));
      }
    }
  }
  return failed;
}

function copyWithSiblings(basePath, destPath) {
  const dir = path.dirname(basePath);
  const base = path.basename(basePath);
  const destBase = path.basename(destPath);
  const entries = fs.readdirSync(dir);
  let copiedMain = false;
  for (const entry of entries) {
    if (entry === base) {
      fs.copyFileSync(path.join(dir, entry), destPath);
      copiedMain = true;
    } else if (entry.startsWith(base)) {
      const suffix = entry.slice(base.length);
      fs.copyFileSync(path.join(dir, entry), path.join(path.dirname(destPath), destBase + suffix));
    }
  }
  if (!copiedMain) throw new Error("コピー元の本体ファイルが見つかりません: " + basePath);
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

// 戻り値: 最終的に削除できなかったファイルのパス一覧(空配列なら全て削除成功)。
async function cleanupSiblings(basePath) {
  const dir = path.dirname(basePath);
  const base = path.basename(basePath);
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return [];
  }
  const failed = [];
  for (const entry of entries) {
    if (entry === base || entry.startsWith(base)) {
      const full = path.join(dir, entry);
      try {
        await retryOnBusy(() => fs.unlinkSync(full));
      } catch {
        failed.push(full);
      }
    }
  }
  return failed;
}

function logCleanupResult(log, leftover) {
  if (leftover.length > 0) {
    log("警告: 以下のファイルの削除に失敗しました(手動確認が必要です。既存バックアップ・本番データではありません): " + leftover.join(", "));
  }
}

// config: { remoteUrl, authToken, backupDir, prefix, log, countTimeoutMs, syncTimeoutMs }
// 戻り値: { success, reason, snapshotPath, logPath }
async function runTursoSyncBackup(config) {
  const log = config.log || ((...args) => console.log(...args));
  const backupDir = config.backupDir || DEFAULT_BACKUP_DIR;
  const prefix = config.prefix || "tursotest";

  if (!config.remoteUrl || !config.authToken) {
    log("RESULT=FAILURE");
    log("対象DBのURL・トークンが指定されていません(環境変数未設定)。ネットワーク接続は行いません。");
    return { success: false, reason: "missing-config" };
  }

  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const replicaPath = path.join(backupDir, `${prefix}_replica_${ts}.db`);
  const snapshotPath = path.join(backupDir, `${prefix}_snapshot_${ts}.db`);
  const logPath = path.join(backupDir, `${prefix}_snapshot_${ts}.log.json`);

  for (const p of [replicaPath, snapshotPath, logPath]) {
    const r = reserveFile(p);
    if (!r.ok) {
      log("RESULT=FAILURE");
      log(r.reason);
      return { success: false, reason: r.reason };
    }
  }
  logCleanupResult(log, await cleanupSiblings(replicaPath));
  fs.unlinkSync(snapshotPath);
  fs.unlinkSync(logPath);

  log("=== Turso Embedded Replica バックアップ(@libsql/client 0.18.0) ===");
  log("ローカルレプリカ: " + replicaPath);

  // --- 1. リモートの件数・内容ハッシュを、レプリカとは別の直結接続で取得する ---
  let remoteSnapshot;
  try {
    remoteSnapshot = await fetchRemoteSnapshot(config.remoteUrl, config.authToken, config.countTimeoutMs || 20000);
    log("リモート直結での件数・ハッシュ取得: OK");
  } catch (e) {
    log("RESULT=FAILURE");
    log("リモートへの直結接続・データ取得に失敗しました: " + e.message.split("\n")[0]);
    logCleanupResult(log, await cleanupSiblings(replicaPath));
    return { success: false, reason: "remote-fetch-failed: " + e.message.split("\n")[0] };
  }

  // --- 2. Embedded Replicaへ同期する ---
  let replicaClient;
  try {
    replicaClient = createClient({ url: `file:${replicaPath}`, syncUrl: config.remoteUrl, authToken: config.authToken });
    await withTimeout(replicaClient.sync(), config.syncTimeoutMs || 30000, "Embedded Replica同期");
    log("Embedded Replicaへの同期: OK");
  } catch (e) {
    log("RESULT=FAILURE");
    log("Embedded Replicaへの同期に失敗しました: " + e.message.split("\n")[0]);
    try { if (replicaClient) replicaClient.close(); } catch {}
    logCleanupResult(log, await cleanupSiblings(replicaPath));
    return { success: false, reason: "sync-failed: " + e.message.split("\n")[0] };
  } finally {
    try { if (replicaClient) replicaClient.close(); } catch {}
  }

  // --- 3. 完全にクローズした後、元のレプリカファイルには一切触れず、別名でコピーする ---
  // 本体だけでなく見つかった付随ファイルも同じ命名対応を保ったまま全てコピーし、
  // 取りこぼしのリスクを無くす(真のEmbedded Replicaで副ファイルが生成される場合に備える)。
  try {
    await retryOnBusy(() => copyWithSiblings(replicaPath, snapshotPath));
    log("クローズ後のレプリカ(本体+付随ファイル)をスナップショットへコピー: OK");
  } catch (e) {
    log("RESULT=FAILURE");
    log("スナップショットへのコピーに失敗しました: " + e.message.split("\n")[0]);
    logCleanupResult(log, await cleanupSiblings(replicaPath));
    try { fs.unlinkSync(snapshotPath); } catch {}
    return { success: false, reason: "copy-failed: " + e.message.split("\n")[0] };
  }

  // --- 4. スナップショットをWALチェックポイントで単一ファイルへ統合し、読み取り専用検証する ---
  let localSnapshot;
  try {
    logCleanupResult(log, await consolidateSnapshot(snapshotPath));
    localSnapshot = snapshotLocalFile(snapshotPath);
  } catch (e) {
    log("RESULT=FAILURE");
    log("スナップショットの統合・検証に失敗しました: " + e.message.split("\n")[0]);
    logCleanupResult(log, await cleanupSiblings(replicaPath));
    return { success: false, reason: "verify-failed: " + e.message.split("\n")[0] };
  }

  let decision = decideSuccess(remoteSnapshot, localSnapshot);

  // リモートの比較時点(手順1)と同期完了後のローカル状態(手順2〜4)の間に、リモート側で
  // 実際にデータが変化した場合、件数・ハッシュがずれること自体は不具合ではない。
  // そのため、不一致(整合性エラーではない場合)は1回だけリモートを再取得して再比較し、
  // 再取得後も不一致が続く場合のみ本当の失敗として扱う。
  if (!decision.success && localSnapshot.integrity === "ok") {
    log("件数/ハッシュの不一致を検出。比較時点のずれの可能性があるため、リモートを再取得して再比較します。");
    try {
      const recheckSnapshot = await fetchRemoteSnapshot(config.remoteUrl, config.authToken, config.countTimeoutMs || 20000);
      const recheckDecision = decideSuccess(recheckSnapshot, localSnapshot);
      if (recheckDecision.success) {
        log("再比較の結果、一致しました(比較時点のずれだったと判断)。");
        decision = recheckDecision;
        remoteSnapshot = recheckSnapshot;
      } else {
        decision = { success: false, reason: "再比較しても不一致: " + recheckDecision.reason };
      }
    } catch (e) {
      log("再比較のためのリモート再取得に失敗しました: " + e.message.split("\n")[0]);
    }
  }

  if (!decision.success) {
    log("RESULT=FAILURE");
    log(decision.reason);
    log("不完全なバックアップのため、作成したファイルは成功扱いせず削除します。");
    logCleanupResult(log, await cleanupSiblings(replicaPath));
    try { fs.unlinkSync(snapshotPath); } catch {}
    return { success: false, reason: decision.reason };
  }

  const logData = {
    executedAt: new Date().toISOString(),
    snapshotPath,
    integrityCheck: localSnapshot.integrity,
    counts: localSnapshot.counts,
    remoteCounts: remoteSnapshot.counts,
    note: "空テーブルの場合、同期の成功は確認できても実データ保持の検証にはならない。",
  };
  fs.writeFileSync(logPath, JSON.stringify(logData, null, 2), "utf8");

  log("RESULT=SUCCESS");
  log("スナップショット: " + snapshotPath);
  log("ログ: " + logPath);

  logCleanupResult(log, await cleanupSiblings(replicaPath));

  return { success: true, reason: null, snapshotPath, logPath };
}

module.exports = {
  runTursoSyncBackup,
  canonicalValue,
  rowHash,
  snapshotLocalFile,
  decideSuccess,
  fetchRemoteSnapshot,
  reserveFile,
  cleanupSiblings,
  copyWithSiblings,
  consolidateSnapshot,
  retryOnBusy,
  isMissingTableError,
  TABLES,
};

// .envファイルへの貼り付け時に、括弧・引用符が誤って前後に残ってしまうことがあるため
// (turso-restore.cjsの運用で実際に発生した)、値の前後だけを安全に取り除く。
function cleanEnvValue(v) {
  if (!v) return v;
  return v.trim().replace(/^[("']+/, "").replace(/[)"']+$/, "");
}

if (require.main === module) {
  runTursoSyncBackup({
    remoteUrl: cleanEnvValue(process.env.TURSO_TEST_DATABASE_URL),
    authToken: cleanEnvValue(process.env.TURSO_TEST_READONLY_TOKEN),
  })
    .then((r) => {
      process.exitCode = r.success ? 0 : 1;
    })
    .catch((e) => {
      console.log("RESULT=FAILURE");
      console.log("想定外のエラー: " + e.message.split("\n")[0]);
      process.exitCode = 1;
    });
}
