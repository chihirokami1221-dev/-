"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { generateMonthOptions, monthToDateRange } from "@/lib/monthOptions";

const MONTH_OPTIONS = generateMonthOptions();

export function NewPhaseForm({ categoryId }: { categoryId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [month, setMonth] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    const { startDate, dueDate } = month ? monthToDateRange(month) : { startDate: null, dueDate: null };
    const res = await fetch("/api/roadmap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        categoryId,
        startDate,
        dueDate,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("追加に失敗しました。もう一度お試しください。");
      return;
    }
    setTitle("");
    setMonth("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/40 p-4 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
      >
        + 計画ブロックを追加
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/30 p-4">
      {error && <p className="mb-2 text-xs font-medium text-red-600">{error}</p>}
      <div className="flex flex-col gap-2">
        <Select value={month} onChange={(e) => setMonth(e.target.value)} className="text-sm">
          <option value="">時期(任意)</option>
          {MONTH_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトル(例: 商品理解・企画準備)" autoFocus className="text-sm" />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={saving}>キャンセル</Button>
          <Button type="button" onClick={add} disabled={saving}>{saving ? "追加中..." : "追加"}</Button>
        </div>
      </div>
    </div>
  );
}
