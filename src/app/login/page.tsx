"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitLogin } from "@/lib/loginClient";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    // submitLogin内部で通信全体に20秒のタイムアウトを設けている。tryが無いと通信失敗時に
    // 例外が外へ飛び、setSubmitting(false)が実行されずボタンが「確認中...」のまま固まり、
    // エラーメッセージも出ないまま無反応に見えてしまう(実際に発生した不具合)。
    try {
      const result = await submitLogin(password);
      if (!result.ok) {
        setError(result.error ?? "パスワードが正しくありません。");
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-bold text-slate-900">成長OS</h1>
        <p className="mb-4 text-sm text-slate-500">パスワードを入力してください。</p>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          placeholder="パスワード"
        />
        <button
          type="submit"
          disabled={submitting || !password}
          className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? "確認中..." : "ログイン"}
        </button>
      </form>
    </div>
  );
}
