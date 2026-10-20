// ログイン画面のfetch呼び出しをまとめた関数。UIから分離してユニットテスト可能にする。
// AbortControllerで通信全体にタイムアウトを設け、失敗時は必ず日本語のエラー文言を返す
// (認証情報・内部情報は含めない)。認証処理自体(Cookie設定・CSRF等)はAPI側の既存仕様のまま変更しない。

export interface LoginResult {
  ok: boolean;
  error?: string;
}

export async function submitLogin(
  password: string,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<LoginResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 20000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
      signal: controller.signal,
    });

    if (!res.ok) {
      return { ok: false, error: "パスワードが正しくありません。" };
    }
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return { ok: false, error: "通信がタイムアウトしました。もう一度お試しください。" };
    }
    return { ok: false, error: "通信に失敗しました。もう一度お試しください。" };
  } finally {
    clearTimeout(timer);
  }
}
