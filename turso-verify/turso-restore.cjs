// 成長OS: バックアップファイル(turso-sync-backup.cjsが作る単一.dbファイル)から、
// Tursoデータベースへ復元するスクリプト。この独立環境(@libsql/client@0.18.0)で動作する。
//
// 安全設計の要点:
// - 復元先が「全13テーブル0件(空)」であることを事前に確認し、1件でもデータがあれば
//   即座に中止する(既存データの上書き・重複投入を防ぐ)。
// - 誤った接続先への復元を防ぐため、呼び出し側はターゲットURLのホスト名の一部に
//   一致することが期待される文字列(expectedHostSubstring)を明示的に渡さなければならない。
//   一致しなければネットワーク接続を一切行わず中止する。
// - 全テーブル・全行のINSERTを、1回のbatch()呼び出しにまとめて実行する。
//   libSQLのbatch()は公式に「1つのトランザクションにまとめて実行され、
//   いずれかが失敗すれば全体がロールバックされる」ため、途中失敗時に一部だけ
//   書き込まれた状態を残さない。
// - 復元後、ソースとターゲットの件数・内容ハッシュを比較し、完全一致した場合のみ成功とする。
// - 秘密情報(URL・トークン)は環境変数でのみ受け取り、ログに出力しない。

const { createClient } = require("@libsql/client");
const { DatabaseSync } = require("node:sqlite");
const crypto = require("node:crypto");

// backup-sqlite.cjs/turso-sync-backup.cjsと同じ13テーブル・FKを満たす順序
// (Category等の参照先を先に書き込む)。
const TABLES_IN_FK_ORDER = [
  "Category", "Event", "RoadmapItem", "KeyAction", "IndividualGoal",
  "DiaryEntry", "Achievement", "AchievementAxisLink", "TodayTask",
  "WeeklyTodoItem", "MarketValueScoreSnapshot", "MarketDataEntry", "Memo",
];

function canonicalValue(value) {
  if (value === null) return "\u0000NULL\u0000";
  if (value instanceof ArrayBuffer || Buffer.isBuffer(value)) {
    return "\u0000BLOB:" + Buffer.from(value).toString("hex") + "\u0000";
  }
  return JSON.stringify(value);
}

function rowHash(row, columns) {
  return crypto.createHash("sha256").update(columns.map((c) => `${c}=${canonicalValue(row[c])}`).join("\u0001"), "utf8").digest("hex");
}

function sortedHashes(rows, columns, idCol) {
  return rows.map((r) => ({ id: r[idCol], hash: rowHash(r, columns) })).sort((a, b) => (a.id > b.id ? 1 : a.id < b.id ? -1 : 0));
}

function readSourceBackup(backupPath) {
  const conn = new DatabaseSync(backupPath, { readOnly: true });
  try {
    const integrity = conn.prepare("PRAGMA integrity_check").get().integrity_check;
    const tables = {};
    for (const t of TABLES_IN_FK_ORDER) {
      let cols, rows;
      try {
        cols = conn.prepare(`PRAGMA table_info("${t}")`).all().map((c) => c.name);
        rows = conn.prepare(`SELECT * FROM "${t}"`).all();
      } catch {
        // テーブルが存在しない場合は、ターゲット側(fetchTargetSnapshot)のnull表現と
        // 揃える(片方だけ{cols:[],rows:[]}、もう片方nullだと、両方とも「存在しない」
        // ケースなのに偽の不一致として検出されてしまうため)。
        tables[t] = null;
        continue;
      }
      tables[t] = { cols, rows };
    }
    return { integrity, tables };
  } finally {
    conn.close();
  }
}

function withTimeout(promise, timeoutMs, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`タイムアウト(${timeoutMs}ms): ${label}`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// 復元先が本当に空(全テーブル0件)であることを確認する。1件でもあれば中止対象。
async function verifyTargetIsEmpty(client, timeoutMs = 20000) {
  const nonEmpty = [];
  for (const t of TABLES_IN_FK_ORDER) {
    try {
      const rs = await withTimeout(client.execute(`SELECT COUNT(*) as c FROM "${t}"`), timeoutMs, `件数確認(${t})`);
      const count = Number(rs.rows[0].c);
      if (count > 0) nonEmpty.push(`${t}(${count}件)`);
    } catch (e) {
      if (!/no such table/i.test(e.message)) throw e;
    }
  }
  return nonEmpty;
}

async function fetchTargetSnapshot(client, timeoutMs = 20000) {
  const counts = {};
  const hashes = {};
  for (const t of TABLES_IN_FK_ORDER) {
    try {
      const rs = await withTimeout(client.execute(`SELECT * FROM "${t}"`), timeoutMs, `復元後確認(${t})`);
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
      if (/no such table/i.test(e.message)) {
        counts[t] = null;
        hashes[t] = null;
        continue;
      }
      throw e;
    }
  }
  return { counts, hashes };
}

// config: { backupPath, targetUrl, targetToken, expectedHostSubstring, log }
// 戻り値: { success, reason }
async function restoreFromBackup(config) {
  const log = config.log || ((...args) => console.log(...args));

  if (!config.backupPath || !config.targetUrl || !config.targetToken) {
    log("RESULT=FAILURE");
    log("backupPath・targetUrl・targetTokenが指定されていません。ネットワーク接続は行いません。");
    return { success: false, reason: "missing-config" };
  }

  if (!config.expectedHostSubstring) {
    log("RESULT=FAILURE");
    log("誤接続防止のため、expectedHostSubstring(接続先ホスト名に含まれるべき文字列)の指定が必須です。");
    return { success: false, reason: "missing-host-confirmation" };
  }

  let hostname;
  try {
    const normalized = config.targetUrl.replace(/^libsql:/, "https:").replace(/^libsql/, "https");
    const parsed = new URL(normalized);
    // file:(ローカルファイル。テスト専用)はhostnameが常に空になるため、
    // 代わりにpathnameで照合する。本番で使うTursoの libsql:/https:/wss: 等では
    // 通常通りhostnameを使う(挙動を変えない)。
    hostname = parsed.protocol === "file:" ? parsed.pathname : parsed.hostname;
  } catch (e) {
    log("RESULT=FAILURE");
    log("targetUrlを解析できませんでした: " + e.message);
    return { success: false, reason: "invalid-url" };
  }

  if (!hostname.includes(config.expectedHostSubstring)) {
    log("RESULT=FAILURE");
    log("接続先ホスト名がexpectedHostSubstringと一致しないため、接続せず中止します(誤接続防止)。");
    return { success: false, reason: "host-mismatch" };
  }

  // --- 1. バックアップファイルを読み取り専用で読み込む ---
  let source;
  try {
    source = readSourceBackup(config.backupPath);
  } catch (e) {
    log("RESULT=FAILURE");
    log("バックアップファイルの読み込みに失敗しました: " + e.message.split("\n")[0]);
    return { success: false, reason: "backup-read-failed" };
  }
  if (source.integrity !== "ok") {
    log("RESULT=FAILURE");
    log("バックアップファイル自体のintegrity_checkがokではありません: " + source.integrity);
    return { success: false, reason: "backup-corrupted" };
  }
  log("バックアップファイルの読み込み: OK(integrity_check=ok)");

  // --- 2. 復元先に接続し、本当に空であることを確認する ---
  const client = createClient({ url: config.targetUrl, authToken: config.targetToken });
  try {
    const nonEmpty = await verifyTargetIsEmpty(client, config.timeoutMs);
    if (nonEmpty.length > 0) {
      log("RESULT=FAILURE");
      log("復元先が空ではないため中止します(既存データ保護): " + nonEmpty.join(", "));
      return { success: false, reason: "target-not-empty" };
    }
    log("復元先が空であることを確認: OK");

    // --- 3. 全テーブル・全行のINSERTを1つのbatch()にまとめ、原子的に実行する ---
    const statements = [];
    for (const t of TABLES_IN_FK_ORDER) {
      if (source.tables[t] === null) continue; // ソースに存在しないテーブルは復元対象外
      const { cols, rows } = source.tables[t];
      if (rows.length === 0) continue;
      const placeholders = cols.map(() => "?").join(",");
      const sql = `INSERT INTO "${t}" (${cols.map((c) => `"${c}"`).join(",")}) VALUES (${placeholders})`;
      for (const row of rows) {
        statements.push({ sql, args: cols.map((c) => row[c]) });
      }
    }

    if (statements.length === 0) {
      log("復元対象のデータが0件のため、書き込みは発生しません。");
    } else {
      await withTimeout(client.batch(statements, "write"), config.timeoutMs || 30000, "復元書き込み(batch)");
      log(`復元書き込み: OK(${statements.length}行、1トランザクション)`);
    }

    // --- 4. 復元後の内容を再取得し、ソースと比較する ---
    const targetSnapshot = await fetchTargetSnapshot(client, config.timeoutMs);
    const mismatches = [];
    for (const t of TABLES_IN_FK_ORDER) {
      if (source.tables[t] === null) {
        // ソースにテーブルが存在しない場合、ターゲットにも存在しなければ整合(両方「無い」)。
        if (targetSnapshot.counts[t] !== null) mismatches.push(t);
        continue;
      }
      const { cols, rows } = source.tables[t];
      const idCol = cols.includes("id") ? "id" : cols[0];
      const sourceHash = JSON.stringify(sortedHashes(rows, cols, idCol));
      const targetHash = JSON.stringify(targetSnapshot.hashes[t]);
      if (rows.length !== (targetSnapshot.counts[t] ?? 0) || sourceHash !== targetHash) {
        mismatches.push(t);
      }
    }

    if (mismatches.length > 0) {
      log("RESULT=FAILURE");
      log("復元後の内容が一致しないテーブルがあります: " + mismatches.join(", "));
      return { success: false, reason: "verify-mismatch: " + mismatches.join(",") };
    }

    log("RESULT=SUCCESS");
    log("復元後の件数・内容ハッシュが、バックアップファイルと完全に一致しました。");
    return { success: true, reason: null };
  } catch (e) {
    log("RESULT=FAILURE");
    log("復元処理中にエラーが発生しました(batch()の仕様により、書き込みは行われていないかロールバック済みです): " + e.message.split("\n")[0]);
    return { success: false, reason: "restore-failed: " + e.message.split("\n")[0] };
  } finally {
    try { client.close(); } catch {}
  }
}

module.exports = { restoreFromBackup, readSourceBackup, verifyTargetIsEmpty, fetchTargetSnapshot, canonicalValue, rowHash, TABLES_IN_FK_ORDER };

if (require.main === module) {
  restoreFromBackup({
    backupPath: process.argv[2],
    targetUrl: process.env.TURSO_RESTORE_TARGET_URL,
    targetToken: process.env.TURSO_RESTORE_TARGET_TOKEN,
    expectedHostSubstring: process.argv[3],
  })
    .then((r) => { process.exitCode = r.success ? 0 : 1; })
    .catch((e) => {
      console.log("RESULT=FAILURE");
      console.log("想定外のエラー: " + e.message.split("\n")[0]);
      process.exitCode = 1;
    });
}
