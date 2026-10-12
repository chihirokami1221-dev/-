"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CategoryOption {
  id: string;
  label: string;
}

// ロードマップの重点行動からの自動生成とは別に、個別目標を直接登録するためのフォーム。
// 対象月ではなく期限(いつまでに)を選ぶ(自動生成の個別目標も期限で紐づくため、ここだけ月選択にすると扱いが変わってしまう)。
export function NewGoalForm({ categories }: { categories: CategoryOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    if (!title.trim() || !categoryId) return;
    setSaving(true);
    setError(null);

    const res = await fetch("/api/individual-goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        content,
        categoryId,
        dueDate: dueDate || null,
      }),
    });

    setSaving(false);
    if (!res.ok) {
      setError("追加に失敗しました。もう一度お試しください。");
      return;
    }
    setTitle("");
    setContent("");
    setDueDate("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-4 w-full rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/40 p-3 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
      >
        + 目標を追加(ロードマップからの自動生成とは別に登録)
      </button>
    );
  }

  return (
    <div className="mb-4 rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/30 p-4">
      {error && <p className="mb-2 text-xs font-medium text-red-600">{error}</p>}
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="text-sm">
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="text-sm" />
        </div>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="目標のタイトル" autoFocus className="text-sm" />
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          className="text-xs"
          placeholder="具体的な行動(任意・箇条書き可)"
        />
        <p className="text-xs text-slate-400">進行度・優先度は登録後にカード上から設定できます。</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={saving}>キャンセル</Button>
          <Button type="button" onClick={add} disabled={saving}>{saving ? "追加中..." : "追加"}</Button>
        </div>
      </div>
    </div>
  );
}
