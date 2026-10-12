"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { PlaceholderNotice } from "@/components/ui/PlaceholderNotice";

interface CategoryOption {
  id: string;
  label: string;
}

interface DiaryFormInitial {
  id?: string;
  date?: Date | string;
  categoryId?: string;
  content?: string;
  aiAnalysisNote?: string | null;
}

function toDateInputValue(date?: Date | string): string {
  if (!date) return new Date().toISOString().slice(0, 10);
  return new Date(date).toISOString().slice(0, 10);
}

export function DiaryForm({
  categories,
  initial,
}: {
  categories: CategoryOption[];
  initial?: DiaryFormInitial;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState(toDateInputValue(initial?.date));
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? categories[0]?.id ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [aiAnalysisNote, setAiAnalysisNote] = useState(initial?.aiAnalysisNote ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const url = initial?.id ? `/api/diary/${initial.id}` : "/api/diary";
    const method = initial?.id ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, categoryId, content, aiAnalysisNote }),
    });

    setSubmitting(false);

    if (!res.ok) {
      setError("記録に失敗しました。入力内容を確認してください。");
      return;
    }

    router.push("/diary");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">日付</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">カテゴリー</label>
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">今日の出来事</label>
        <Textarea
          required
          rows={8}
          placeholder="今日は何をした？何を学んだ？どんな課題があった？自由に書いてください。"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>

      <PlaceholderNotice message="必要であれば下記に自分で気づき・分析メモを残せます。AIに相談したいときはAIチャットタブをご利用ください。" />

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">分析メモ(任意・自分で記入)</label>
        <Textarea
          rows={3}
          placeholder="例: 行動/学習/成果/次の行動 など気づいたことを自由に"
          value={aiAnalysisNote}
          onChange={(e) => setAiAnalysisNote(e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "記録中..." : "記録する"}
        </Button>
      </div>
    </form>
  );
}
