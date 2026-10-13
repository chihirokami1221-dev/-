// 成長OS: 安全な手動バックアップスクリプト(Phase C-19〜C-26で検証・改善した方式)。
// Node.js標準機能のみを使用(node:sqlite の backup()、node:crypto の SHA-256)。追加パッケージなし。
//
// 使い方:
//   node backup-sqlite.cjs            通常モード。prisma/dev.db を読み取り専用でバックアップする。
//   node backup-sqlite.cjs <dbパス>   テストモード。指定したDBファイルを対象にする(実データ以外の検証用)。
//
// バックアップ先: C:\Users\chihiro\AppData\Local\GrowthOSBackups
// 既存ファイルは一切上書きしない。本文・個人情報はログに出力しない(件数・ハッシュ値のみ記録)。

const { DatabaseSync, backup } = require("node:sqlite");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const DEFAULT_DB_PATH = path.join(__dirname, "prisma", "dev.db");
const BACKUP_DIR = "C:\\Users\\chihiro\\AppData\\Local\\GrowthOSBackups";
const ONEDRIVE_ROOTS = ["C:\\Users\\chihiro\\OneDrive", "C:\\Users\\chihiro\\OneDrive - Aoyama Gakuin"];

const TABLES = [
  "Category", "Event", "RoadmapItem", "KeyAction", "IndividualGoal",
  "DiaryEntry", "Achievement", "AchievementAxisLink", "TodayTask",
  "WeeklyTodoItem", "MarketValueScoreSnapshot", "MarketDataEntry", "Memo",
];

// 修正3: どの中断経路でも、開いている元DB接続をできる範囲で確実にクローズしてから終了する。
// クローズ自体が失敗しても(既に閉じている等)、元DB・既存バックアップには一切触れない。
function stop(reason, srcDb) {
  if (srcDb) {
    try {
      srcDb.close();
    } catch {
      // クローズ失敗は無視する(プロセス終了により最終的にはOSが解放する)。元DBへの書き込みは行わない。
    }
  }
  console.log("\n中止しました。");
  console.log("理由: " + reason);
  console.log("元DB・既存バックアップへの変更は一切行っていません。");
  process.exit(1);
}

function canonical(value) {
  if (value === null) return "\u0000NULL\u0000";
  if (Buffer.isBuffer(value)) return "\u0000BLOB:" + value.toString("hex") + "\u0000";
  return JSON.stringify(value);
}

function rowHash(row, columns) {
  return crypto.createHash("sha256").update(columns.map((c) => `${c}=${canonical(row[c])}`).join("\u0001"), "utf8").digest("hex");
}

function snapshot(conn) {
  const integrity = conn.prepare("PRAGMA integrity_check").get().integrity_check;
  const fkViolations = conn.prepare("PRAGMA foreign_key_check").all().length;
  const counts = {};
  const hashes = {};
  for (const t of TABLES) {
    let cols, rows;
    try {
      cols = conn.prepare(`PRAGMA table_info("${t}")`).all().map((c) => c.name);
      rows = conn.prepare(`SELECT * FROM "${t}"`).all();
    } catch {
      // テスト用DB等、13テーブルの一部が存在しない場合はスキップする(実DBでは通常発生しない)。
      counts[t] = null;
      hashes[t] = null;
      continue;
    }
    counts[t] = rows.length;
    const idCol = cols.includes("id") ? "id" : cols[0];
    hashes[t] = rows.map((r) => ({ id: r[idCol], hash: rowHash(r, cols) })).sort((a, b) => (a.id > b.id ? 1 : -1));
  }
  return { integrity, fkViolations, counts, hashes };
}

// 修正1: fs.existsSyncによる事前チェックだけに頼らず、"wx"(排他的新規作成)でファイル名を
// アトミックに確保する。2プロセスが同時に同名を狙っても、片方だけが確保に成功する。
// 戻り値: { ok: true } または { ok: false, reason }。
// 成功時、確保した空ファイルのファイルディスクリプタはこの関数内で閉じる(中身は後で書く)。
function reserveFile(filePath) {
  let fd;
  try {
    fd = fs.openSync(filePath, "wx");
  } catch (e) {
    if (e.code === "EEXIST") {
      return { ok: false, reason: "ファイルが既に存在します(名前の衝突): " + filePath };
    }
    return { ok: false, reason: "ファイルを確保できませんでした(" + filePath + "): " + e.message.split("\n")[0] };
  }
  fs.closeSync(fd);
  return { ok: true };
}

async function main() {
  const argPath = process.argv[2];
  const isTestMode = !!argPath;
  const dbPath = isTestMode ? path.resolve(argPath) : DEFAULT_DB_PATH;

  console.log("=== 成長OS バックアップスクリプト ===");
  if (isTestMode) {
    console.log("【テストモード】実際のGrowth OSデータベースではなく、指定されたパスを対象にしています。");
  }
  console.log("対象DB: " + dbPath);

  // --- 1. 対象DBの確認 ---
  if (!fs.existsSync(dbPath)) stop("対象DBが見つかりません: " + dbPath);
  if (!isTestMode && dbPath !== DEFAULT_DB_PATH) stop("想定外のDBパスです(内部エラー)");

  let srcDb;
  try {
    srcDb = new DatabaseSync(dbPath, { readOnly: true });
  } catch (e) {
    stop("対象DBを読み取り専用で開けませんでした: " + e.message.split("\n")[0]);
  }
  console.log("読み取り専用オープン: OK(ローカルSQLiteファイルのみ。ネットワーク接続は行いません)");

  // --- 2. バックアップ先の確認 ---
  if (ONEDRIVE_ROOTS.some((r) => BACKUP_DIR.startsWith(r))) {
    // 修正3: 中断前に元DB接続をクローズする(他の中断経路と統一)。
    stop("バックアップ先がOneDrive同期対象の可能性があります", srcDb);
  }
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log("バックアップ先ディレクトリを新規作成しました: " + BACKUP_DIR);
  } else {
    console.log("バックアップ先ディレクトリ: OK(既存)");
  }
  try {
    const testFile = path.join(BACKUP_DIR, "___write_test.tmp");
    fs.writeFileSync(testFile, "test");
    fs.unlinkSync(testFile);
    console.log("書き込み権限: OK");
  } catch (e) {
    stop("バックアップ先への書き込み権限がありません: " + e.message.split("\n")[0], srcDb);
  }

  // --- 修正1: バックアップファイル・ログファイルの名前を排他的に確保する ---
  const prefix = isTestMode ? "test" : "dev";
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(BACKUP_DIR, `${prefix}_backup_${ts}.db`);
  const logPath = path.join(BACKUP_DIR, `${prefix}_backup_${ts}.log.json`);

  const backupReserve = reserveFile(backupPath);
  if (!backupReserve.ok) {
    stop(backupReserve.reason, srcDb);
  }
  console.log("バックアップ先ファイル名を排他的に確保: OK (" + backupPath + ")");

  const logReserve = reserveFile(logPath);
  if (!logReserve.ok) {
    // ログ側の確保に失敗した場合、"自分がいま確保したばかりの"backupPathの空ファイルのみを削除する。
    // これは今回の実行で自分が新規作成した空ファイルであり、既存の他ファイルには一切触れない。
    try {
      fs.unlinkSync(backupPath);
      console.log("ログファイル名を確保できなかったため、直前に確保したバックアップ用の空ファイルを解放しました: " + backupPath);
    } catch (e) {
      console.log("バックアップ用の空ファイルの解放に失敗しました(手動確認が必要な場合があります): " + backupPath);
    }
    stop(logReserve.reason, srcDb);
  }
  console.log("ログファイル名を排他的に確保: OK (" + logPath + ")");

  // --- 3. バックアップ前の基準値取得(修正2: 元DBの整合性を成功判定に使う) ---
  console.log("\n--- バックアップ前の基準値を取得 ---");
  srcDb.exec("BEGIN");
  const before = snapshot(srcDb);
  srcDb.exec("COMMIT");
  console.log("integrity_check: " + before.integrity);
  console.log("foreign_key_check違反: " + before.fkViolations);
  for (const t of TABLES) {
    console.log(`${t}: ${before.counts[t] === null ? "(テーブルなし)" : before.counts[t]}`);
  }

  if (before.integrity !== "ok" || before.fkViolations !== 0) {
    // 元DBに既に異常がある。修復は行わず、バックアップ処理自体を中止する。
    // 確保済みの空ファイル(自分が今回作成したもの)のみ後片付けする。
    try { fs.unlinkSync(backupPath); } catch {}
    try { fs.unlinkSync(logPath); } catch {}
    console.log("\n元DBの整合性に異常が検出されたため、バックアップを作成せず中止します。");
    console.log("integrity_check=" + before.integrity + ", foreign_key_check違反=" + before.fkViolations);
    console.log("元DBの修復は行っていません。原因の調査が必要です。");
    stop("バックアップ前の元DBの整合性チェックで異常が検出されました", srcDb);
  }
  console.log("元DBの整合性チェック: 異常なし。バックアップ処理に進みます。");

  // --- 4. バックアップ実行 ---
  console.log("\n--- backup()を実行 ---");
  const startTime = Date.now();
  let totalPages;
  try {
    totalPages = await backup(srcDb, backupPath, { rate: 50 });
  } catch (e) {
    srcDb.close();
    console.log("\nRESULT=FAILURE");
    console.log("バックアップ処理中にエラーが発生しました: " + e.message.split("\n")[0]);
    console.log("不完全なバックアップファイルが残っている可能性があります。自動削除はしません: " + backupPath);
    // ログは成功時のみ書く設計のため、確保済みの空ログファイルは(自分が作ったものなので)削除する。
    try {
      fs.unlinkSync(logPath);
      console.log("未使用の空ログファイルを削除しました: " + logPath);
    } catch {}
    process.exit(1);
  }
  const elapsedMs = Date.now() - startTime;
  srcDb.close();
  console.log("backup()完了: 転送ページ数=" + totalPages + ", 所要時間=" + elapsedMs + "ms");

  const backupStat = fs.statSync(backupPath);
  console.log("バックアップファイルサイズ: " + backupStat.size + " bytes");

  // --- 5. バックアップ結果の検証 ---
  console.log("\n--- バックアップ結果の検証 ---");
  const targetDb = new DatabaseSync(backupPath, { readOnly: true });
  const after = snapshot(targetDb);
  targetDb.close();
  console.log("integrity_check: " + after.integrity);
  console.log("foreign_key_check違反: " + after.fkViolations);

  let allMatch = true;
  const mismatches = [];
  for (const t of TABLES) {
    const countMatch = before.counts[t] === after.counts[t];
    const hashMatch = JSON.stringify(before.hashes[t]) === JSON.stringify(after.hashes[t]);
    console.log(`${t}: 件数 ${before.counts[t]}->${after.counts[t]} (${countMatch ? "OK" : "NG"}), ハッシュ一致=${hashMatch ? "OK" : "NG"}`);
    if (!countMatch || !hashMatch) { allMatch = false; mismatches.push(t); }
  }

  const success = allMatch && after.integrity === "ok" && after.fkViolations === 0;

  console.log("\n=== 総合結果 ===");
  if (success) {
    console.log("RESULT=SUCCESS");
    const log = {
      executedAt: new Date().toISOString(),
      mode: isTestMode ? "test" : "normal",
      sourcePath: dbPath,
      backupPath,
      backupSize: backupStat.size,
      totalPages,
      elapsedMs,
      counts: after.counts,
      integrityCheck: after.integrity,
      foreignKeyViolations: after.fkViolations,
      allMatch: true,
    };
    fs.writeFileSync(logPath, JSON.stringify(log, null, 2), "utf8");
    console.log("ログ保存先: " + logPath);
  } else {
    console.log("RESULT=FAILURE(不一致テーブル: " + mismatches.join(",") + ")");
    console.log("バックアップは成功として扱いません。作成されたファイルは削除せずそのまま残します: " + backupPath);
    try {
      fs.unlinkSync(logPath);
      console.log("未使用の空ログファイルを削除しました: " + logPath);
    } catch {}
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.log("RESULT=FAILURE");
  console.log("想定外のエラー: " + e.message.split("\n")[0]);
  process.exitCode = 1;
});
