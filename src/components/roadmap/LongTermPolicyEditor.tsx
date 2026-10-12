"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Markdown } from "@/components/ui/Markdown";

// 分野の「長期指針」(方向性の文章)を編集する。ここからロードマップの計画ブロックを自動生成することはしない
// (計画ブロック・行動は下の一覧で個別に構造化入力する)。
export function LongTermPolicyEditor({ categoryId, initialValue }: { categoryId: string; initialValue: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/categories/${categoryId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ longTermPlan: text }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("保存に失敗しました。もう一度お試しください。");
      return;
    }
    setValue(text);
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <div>
        {error && <p className="mb-2 text-xs font-medium text-red-600">{error}</p>}
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder="この分野の長期的な方向性を書きます(例: 何を目指すか、どんな価値観で取り組むか)"
          className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm leading-6 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => { setText(value); setEditing(false); }} disabled={saving}>
            キャンセル
          </Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {value.trim() ? (
        <Markdown text={value} />
      ) : (
        <p className="text-sm text-slate-400">まだ長期指針が登録されていません。</p>
      )}
      <button type="button" onClick={() => setEditing(true)} className="mt-2 text-xs text-emerald-600 hover:text-emerald-700">
        編集する
      </button>
    </div>
  );
}
