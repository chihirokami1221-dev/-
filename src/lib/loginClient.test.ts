import { test } from "node:test";
import assert from "node:assert/strict";
import { submitLogin } from "./loginClient";

test("submitLogin: 成功時はok:trueを返す", async () => {
  const fetchImpl = (async () => new Response(null, { status: 200 })) as unknown as typeof fetch;
  const result = await submitLogin("correct-password", { fetchImpl });
  assert.deepEqual(result, { ok: true });
});

test("submitLogin: パスワード不一致(401)はok:falseと通常のエラー文言を返す", async () => {
  const fetchImpl = (async () => new Response(null, { status: 401 })) as unknown as typeof fetch;
  const result = await submitLogin("wrong-password", { fetchImpl });
  assert.equal(result.ok, false);
  assert.equal(result.error, "パスワードが正しくありません。");
});

test("submitLogin: fetchがタイムアウト(AbortSignal発火)した場合、タイムアウト専用のエラー文言を返す", async () => {
  const fetchImpl = ((_url: string, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      const signal = init?.signal;
      signal?.addEventListener("abort", () => {
        const err = new Error("The operation was aborted.");
        err.name = "AbortError";
        reject(err);
      });
    })) as unknown as typeof fetch;

  const result = await submitLogin("any-password", { fetchImpl, timeoutMs: 10 });
  assert.equal(result.ok, false);
  assert.equal(result.error, "通信がタイムアウトしました。もう一度お試しください。");
});

test("submitLogin: fetch自体が失敗(ネットワークエラー)した場合、通信エラー文言を返す", async () => {
  const fetchImpl = (async () => {
    throw new TypeError("Failed to fetch");
  }) as unknown as typeof fetch;

  const result = await submitLogin("any-password", { fetchImpl });
  assert.equal(result.ok, false);
  assert.equal(result.error, "通信に失敗しました。もう一度お試しください。");
});

test("submitLogin: どの結果でもエラー文言に認証情報・パスワードを含めない", async () => {
  const password = "super-secret-value-should-not-leak";
  const fetchImpl = (async () => new Response(null, { status: 401 })) as unknown as typeof fetch;
  const result = await submitLogin(password, { fetchImpl });
  assert.equal(result.error?.includes(password), false);
});
