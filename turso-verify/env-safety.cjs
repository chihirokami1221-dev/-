// turso-verify内の全スクリプトで共通して使う、秘密情報の安全な取り扱い専用ユーティリティ。
//
// 背景(実際に発生した事故): .envファイルでURLとトークンの値が入れ替わって設定された状態で
// createClient()を呼んだところ、libSQLクライアントが投げたエラーメッセージに、入力した値が
// そのまま含まれており、それをログへ出力してしまった。
//
// 対策は二重にする。
// 1. 接続を試みる「前」に、URL・トークンの形式を検証し、明らかにおかしい場合は
//    一切接続せず、値を含まない安全なメッセージで中止する(フェイルファスト)。
// 2. それでも拾いきれない未知のエラーに備え、実際に使った値そのものを、エラーメッセージ
//    文字列から機械的に(パターンマッチではなく完全一致の文字列置換で)必ず除去してから
//    ログに渡す(どんな形のエラーでも、設定した値そのものだけは絶対に漏れない)。

// .envファイルへの貼り付け時に、誤って括弧・引用符が前後に残ることがあるため取り除く。
function cleanEnvValue(v) {
  if (!v) return v;
  return v.trim().replace(/^[("']+/, "").replace(/[)"']+$/, "");
}

// URLが "libsql://" 等の接続先URLらしい形式で、かつJWTトークンに見えないことを確認する。
function validateUrlFormat(url) {
  if (!url) return { ok: false, reason: "URLが設定されていません。" };
  if (/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./.test(url)) {
    return { ok: false, reason: "URLの値がトークン(JWT形式)のように見えます。URLとトークンの値が入れ替わっていないか確認してください。" };
  }
  if (!/^(libsql|https?|wss?):\/\//i.test(url)) {
    return { ok: false, reason: "URLが 'libsql://' 等の形式で始まっていません。" };
  }
  return { ok: true };
}

// トークンがJWT形式(ピリオド区切り3分割)で、かつURLらしい形式でないことを確認する。
function validateTokenFormat(token) {
  if (!token) return { ok: false, reason: "トークンが設定されていません。" };
  if (/^(libsql|https?|wss?):\/\//i.test(token)) {
    return { ok: false, reason: "トークンの値がURLのように見えます。URLとトークンの値が入れ替わっていないか確認してください。" };
  }
  const parts = token.split(".");
  if (parts.length !== 3) {
    return { ok: false, reason: "トークンがJWT形式(ピリオドで区切られた3つの部分)ではありません。" };
  }
  return { ok: true };
}

// 接続前にURL・トークンの形式をまとめて検証する。問題があれば、値を一切含まない
// 安全な理由だけを返す(呼び出し側はこれをそのままログ出力してよい)。
function validateCredentials(url, token) {
  const u = validateUrlFormat(url);
  if (!u.ok) return { ok: false, reason: "URLの形式が不正です: " + u.reason };
  const t = validateTokenFormat(token);
  if (!t.ok) return { ok: false, reason: "トークンの形式が不正です: " + t.reason };
  return { ok: true };
}

// エラーメッセージから、実際に使用したsecrets(URL・トークン等の値)を文字列として
// 確実に除去する。正規表現によるパターン推測ではなく、「実際に渡した値そのもの」との
// 完全一致の置換なので、未知の形式のエラーメッセージに値が紛れ込んでいても必ず防げる。
function safeErrorMessage(error, secrets) {
  let msg = String((error && error.message) || error || "");
  msg = msg.split("\n")[0];
  for (const s of secrets || []) {
    if (s && s.length >= 4) {
      msg = msg.split(s).join("[REDACTED]");
    }
  }
  return msg;
}

module.exports = { cleanEnvValue, validateUrlFormat, validateTokenFormat, validateCredentials, safeErrorMessage };
