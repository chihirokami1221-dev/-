// 成長OS: Turso(libSQL) Embedded Replicasを使った読み取り専用バックアップ検証用スクリプト。
// backup-sqlite.cjs とは完全に独立しており、既存のスクリプト・手順書には一切変更を加えない。
//
// 安全設計の要点:
// - 同期中のEmbedded Replicaファイルは、Turso公式ドキュメントが明示的に警告している通り
//   「同期中に別の接続で開くとデータ破損の可能性がある」ため、"sync()→close()"を完全に終えた
//   後に限り、ファイルを別の場所へコピーしてから、そのコピーだけを検証する(元の同期ファイルは
//   検証のために再度開かない)。
// - リモート側の件数は、Embedded Replica接続とは別の「直結・非レプリカ」接続で取得し、
//   ローカルスナップショットの件数と比較する(backup-sqlite.cjsのbefore/after比較と同じ発想)。
// - 対象DB・トークンは環境変数でのみ受け取り、ソースコードに書かない。ログにも値を出力しない。
//
// 使い方(実際の検証用DBに対して):
//   TURSO_TEST_DATABASE_URL=... TURSO_TEST_READONLY_TOKEN=... node turso-sync-backup.cjs
//
// 単体テストからは runTursoSyncBackup() を直接呼び出して使う(環境変数を汚さない)。

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
      hashes[t] = rows.map((r) => ({ id: r[idCol], hash: rowHash(r, cols) })).sort((a, b) => (a.id > b.id ? 1 : -1));
    }
    return { integrity, counts, hashes };
  } finally {
    conn.close();
  }
}

// "no such table"系のSQLエラーかどうかを判定する(接続エラー等とは区別する)。
// これを誤って広く判定すると、本当は接続できていないのに「テーブルが無いだけ」と
// 誤認し、各テーブルで無駄なリトライが繰り返されて処理が長時間ハングする原因になる
// (実際にテストで約5分ハングする不具合として検出された)。
function isMissingTableError(e) {
  const msg = String(e && e.message || "");
  return /no such table/i.test(msg);
}

// タイムアウト付きでPromiseを待つ。timeoutMs経過した場合はエラーで拒否する
// (到達不能なURLに対して無限/長時間リトライし続けるのを防ぐ)。
function withTimeout(promise, timeoutMs, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`タイムアウト(${timeoutMs}ms): ${label}`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// リモートに直結(Embedded Replicaではない、syncUrl無し)した接続で、各テーブルの件数だけを
// 読み取り専用で取得する。認証トークンが読み取り専用でない場合でも、ここではSELECTのみ発行する。
// 接続自体ができない場合は、テーブル単位でリトライし続けず、最初のエラーで即座に失敗させる。
async function fetchRemoteCounts(remoteUrl, authToken, timeoutMs = 20000) {
  const client = createClient({ url: remoteUrl, authToken });
  try {
    const counts = {};
    for (const t of TABLES) {
      try {
        const rs = await withTimeout(
          client.execute(`SELECT COUNT(*) as c FROM "${t}"`),
          timeoutMs,
          `リモート件数取得(${t})`,
        );
        counts[t] = Number(rs.rows[0].c);
      } catch (e) {
        if (isMissingTableError(e)) {
          counts[t] = null; // テーブルが存在しない場合(検証用DB等)はnullとして区別する。
          continue;
        }
        throw e; // 接続エラー・タイムアウト等は、ここで即座に失敗として呼び出し元に伝える。
      }
    }
    return counts;
  } finally {
    client.close();
  }
}

// 件数・整合性から成功/失敗を判定する(実データの内容はこの関数に一切渡さない)。
function decideSuccess(remoteCounts, localSnapshot) {
  if (localSnapshot.integrity !== "ok") {
    return { success: false, reason: "integrity_checkがokではありません: " + localSnapshot.integrity };
  }
  const mismatches = [];
  for (const t of TABLES) {
    const r = remoteCounts[t];
    const l = localSnapshot.counts[t];
    if (r !== l) mismatches.push(`${t}(remote=${r}, local=${l})`);
  }
  if (mismatches.length > 0) {
    return { success: false, reason: "件数が一致しないテーブルがあります: " + mismatches.join(", ") };
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

// basePathちょうど、またはbasePathに続く付随ファイル(-wal, -shm, libSQL独自の
// -client_wal_index 等)をすべて削除する。接尾辞を個別に列挙する方式では、
// ライブラリが新しい付随ファイルを追加した場合に取り残しが発生する
// (実際にテストで-client_wal_indexの取り残しを検出したため、glob方式に変更した)。
//
// close()直後に呼ばれることが多いため、retryOnBusyで待機する(実機テストで、
// リトライせずに即unlinkSyncすると、close()後のロックが原因でEBUSYが握りつぶされ、
// ファイルが削除されずに残ってしまう不具合が実際に発生したため修正した)。
// 戻り値: 最終的に削除できなかったファイルのパス一覧(空配列なら全て削除成功)。
// 呼び出し側は、これが空でない場合にログへ記録し、手動確認が必要なことを明示する。
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

// basePathの本体ファイルだけでなく、同じディレクトリにある付随ファイル(例:
// "<basePath>-client_wal_index"等)も、destPathを基準にした同じ命名対応でコピーする。
// 本体ファイルだけをコピーする方式では、真のEmbedded Replicaで付随ファイルに
// データの一部が残っていた場合に取りこぼす可能性があるため、安全側に倒している。
function copyWithSiblings(basePath, destPath) {
  const dir = path.dirname(basePath);
  const base = path.basename(basePath);
  const destBase = path.basename(destPath);
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch (e) {
    throw e;
  }
  let copiedMain = false;
  for (const entry of entries) {
    if (entry === base) {
      fs.copyFileSync(path.join(dir, entry), destPath);
      copiedMain = true;
    } else if (entry.startsWith(base)) {
      const suffix = entry.slice(base.length); // 例: "-client_wal_index"
      fs.copyFileSync(path.join(dir, entry), path.join(path.dirname(destPath), destBase + suffix));
    }
  }
  if (!copiedMain) throw new Error("コピー元の本体ファイルが見つかりません: " + basePath);
}

// Windowsでは、閉じた直後のファイルハンドル解放に遅延が生じることがある。
// 実機テストで、通常は最大8秒程度だが、sync()がネイティブ側で長時間(約100秒)
// イベントループを占有しながらリトライし続けた直後は、12.5秒の予算でも解放されず
// 削除漏れが発生した。そのため、さらに長い予算でリトライする
// (それでも解放されない場合は、RESULT=FAILUREのログに記録し、呼び出し元で後日手動確認する)。
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

function logCleanupResult(log, leftover) {
  if (leftover.length > 0) {
    log("警告: 以下のファイルの削除に失敗しました(手動確認が必要です。既存バックアップ・本番データではありません): " + leftover.join(", "));
  }
}

// config: { remoteUrl, authToken, backupDir, prefix, log }
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
  // reserveFileは空ファイルを作るだけなので、実際にEmbedded Replica/コピー先として使うには
  // 一度削除して、ライブラリ自身にファイルを作らせる(空ファイルが既に存在すると混乱するため)。
  logCleanupResult(log, await cleanupSiblings(replicaPath));
  fs.unlinkSync(snapshotPath);
  fs.unlinkSync(logPath);

  log("=== Turso Embedded Replica バックアップ検証 ===");
  log("ローカルレプリカ: " + replicaPath);

  // --- 1. リモートの件数を、レプリカとは別の直結接続で取得する ---
  let remoteCounts;
  try {
    remoteCounts = await fetchRemoteCounts(config.remoteUrl, config.authToken, config.countTimeoutMs || 20000);
    log("リモート直結での件数取得: OK");
  } catch (e) {
    log("RESULT=FAILURE");
    log("リモートへの直結接続・件数取得に失敗しました: " + e.message.split("\n")[0]);
    logCleanupResult(log, await cleanupSiblings(replicaPath));
    return { success: false, reason: "remote-count-failed: " + e.message.split("\n")[0] };
  }

  // --- 2. Embedded Replicaへ同期する ---
  let replicaClient;
  try {
    replicaClient = createClient({
      url: `file:${replicaPath}`,
      syncUrl: config.remoteUrl,
      authToken: config.authToken,
    });
    await withTimeout(replicaClient.sync(), config.syncTimeoutMs || 30000, "Embedded Replica同期");
    log("Embedded Replicaへの同期: OK");
  } catch (e) {
    log("RESULT=FAILURE");
    log("Embedded Replicaへの同期に失敗しました: " + e.message.split("\n")[0]);
    try { replicaClient && replicaClient.close(); } catch {}
    logCleanupResult(log, await cleanupSiblings(replicaPath));
    return { success: false, reason: "sync-failed: " + e.message.split("\n")[0] };
  } finally {
    // 同期中は公式に「別接続で開くと破損の可能性がある」とされているため、
    // 検証(スナップショットコピー)に進む前に、必ずこの接続を完全にクローズする。
    try { replicaClient && replicaClient.close(); } catch {}
  }

  // --- 3. 完全にクローズした後、元のレプリカファイルには一切触れず、別名でコピーする ---
  // 注意: ローカル専用クライアント(syncUrl無し)では本体.dbファイル1つにしかデータが
  // 作られないことを合成データで実機確認したが、真のEmbedded Replica(syncUrl使用)で
  // -client_wal_index等の付随ファイルにデータの一部が残る可能性は、実際のTurso接続なしには
  // 完全には排除できない(未確認)。そのため、本体だけでなく見つかった付随ファイルも
  // 同じ命名対応を保ったまま全てコピーし、取りこぼしのリスクを無くす。
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

  // --- 4. コピー(スナップショット)だけをnode:sqliteで読み取り専用検証する ---
  let localSnapshot;
  try {
    localSnapshot = snapshotLocalFile(snapshotPath);
  } catch (e) {
    log("RESULT=FAILURE");
    log("スナップショットの検証に失敗しました: " + e.message.split("\n")[0]);
    return { success: false, reason: "verify-failed: " + e.message.split("\n")[0] };
  }

  const decision = decideSuccess(remoteCounts, localSnapshot);

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
    remoteCounts,
    note: "空テーブルの場合、同期の成功は確認できても実データ保持の検証にはならない。",
  };
  fs.writeFileSync(logPath, JSON.stringify(logData, null, 2), "utf8");

  log("RESULT=SUCCESS");
  log("スナップショット: " + snapshotPath);
  log("ログ: " + logPath);

  // レプリカファイル自体はスナップショットを取った後は不要(検証対象はスナップショット側のみ)。
  logCleanupResult(log, await cleanupSiblings(replicaPath));

  return { success: true, reason: null, snapshotPath, logPath };
}

module.exports = {
  runTursoSyncBackup,
  canonicalValue,
  rowHash,
  snapshotLocalFile,
  decideSuccess,
  fetchRemoteCounts,
  reserveFile,
  cleanupSiblings,
  copyWithSiblings,
  retryOnBusy,
  isMissingTableError,
  TABLES,
};

if (require.main === module) {
  runTursoSyncBackup({
    remoteUrl: process.env.TURSO_TEST_DATABASE_URL,
    authToken: process.env.TURSO_TEST_READONLY_TOKEN,
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
