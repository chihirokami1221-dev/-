"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";

interface Memo {
  id: string;
  title: string;
  content: string;
}

export function MemoForm({ initial }: { initial?: Memo }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);

    if (initial) {
      await fetch(`/api/memos/${initial.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      router.push(`/memo/${initial.id}`);
    } else {
      const res = await fetch("/api/memos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      const created = await res.json();
      router.push(`/memo/${created.id}`);
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">タイトル</label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          placeholder="タイトル(Enterで保存)"
          autoFocus
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">内容</label>
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={10} />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={saving || !title.trim()}>
          {saving ? "保存中..." : "保存"}
        </Button>
      </div>
    </form>
  );
}
