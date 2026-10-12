"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { formatJP } from "@/lib/dateUtils";

interface CategoryOption {
  id: string;
  label: string;
  color: string;
}

interface EventItem {
  id: string;
  title: string;
  date: string;
  categoryId: string;
}

function toDateInputValue(v: string): string {
  return v.slice(0, 10);
}

// 画面右上のスケジュールアイコン。タップすると、分野をタブで選びながら予定(イベント)の
// 追加・確認・編集・削除をまとめて行えるモーダルを開く。予定の管理はここに一本化する。
export function QuickAddEventButton({ categories, events }: { categories: CategoryOption[]; events: EventItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingDate, setEditingDate] = useState("");

  const categoryEvents = events
    .filter((e) => e.categoryId === categoryId)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  function close() {
    setOpen(false);
    setTitle("");
    setDate("");
    setError(null);
    setEditingId(null);
  }

  async function submit() {
    if (!title.trim() || !date || !categoryId) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), date, categoryId }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("追加に失敗しました。もう一度お試しください。");
      return;
    }
    setTitle("");
    setDate("");
    router.refresh();
  }

  function startEdit(e: EventItem) {
    setEditingId(e.id);
    setEditingTitle(e.title);
    setEditingDate(toDateInputValue(e.date));
  }

  async function saveEdit(e: EventItem) {
    if (!editingTitle.trim() || !editingDate) return;
    setError(null);
    const res = await fetch(`/api/events/${e.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editingTitle.trim(), date: editingDate }),
    });
    if (!res.ok) {
      setError("保存に失敗しました。もう一度お試しください。");
      return;
    }
    setEditingId(null);
    router.refresh();
  }

  async function removeEvent(e: EventItem) {
    setError(null);
    const res = await fetch(`/api/events/${e.id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("削除に失敗しました。もう一度お試しください。");
      return;
    }
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="予定を管理"
        title="予定を管理"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber-300 bg-amber-50 text-lg text-amber-600 shadow-sm hover:bg-amber-100"
      >
        📅
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4" onClick={close}>
          <div
            className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-base font-bold text-slate-900">予定(イベント)</h3>

            {error && <p className="mb-2 text-xs font-medium text-red-600">{error}</p>}

            <div className="mb-3 flex gap-1 rounded-full bg-slate-100 p-1">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setCategoryId(c.id); setEditingId(null); }}
                  className={`flex-1 rounded-full px-2 py-1.5 text-xs font-semibold transition-colors ${
                    categoryId === c.id ? "text-white" : "text-slate-600 hover:bg-slate-200"
                  }`}
                  style={categoryId === c.id ? { backgroundColor: c.color } : undefined}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {categoryEvents.length === 0 ? (
              <p className="mb-3 text-xs text-slate-400">まだ予定が登録されていません。</p>
            ) : (
              <ul className="mb-3 flex flex-col gap-1.5">
                {categoryEvents.map((e) => (
                  <li key={e.id} className="rounded-lg border border-slate-100 bg-slate-50/60 px-2 py-1.5">
                    {editingId === e.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Input value={editingTitle} onChange={(ev) => setEditingTitle(ev.target.value)} className="min-w-0 flex-1 text-xs" autoFocus />
                        <Input type="date" value={editingDate} onChange={(ev) => setEditingDate(ev.target.value)} className="text-xs" />
                        <Button type="button" variant="secondary" onClick={() => saveEdit(e)} className="text-xs">保存</Button>
                        <Button type="button" variant="secondary" onClick={() => setEditingId(null)} className="text-xs">取消</Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 text-amber-500">◇</span>
                        <span className="shrink-0 text-[11px] text-slate-400">{formatJP(new Date(e.date))}</span>
                        <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{e.title}</span>
                        <button type="button" onClick={() => startEdit(e)} className="text-[11px] text-emerald-600 hover:text-emerald-700">編集</button>
                        <button type="button" onClick={() => removeEvent(e)} className="text-[11px] text-slate-400 hover:text-red-500">削除</button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="予定名(例: 盛夏号プレプレ)"
                className="text-sm"
              />
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="text-sm" />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={close} disabled={saving}>
                  閉じる
                </Button>
                <Button type="button" onClick={submit} disabled={saving}>
                  {saving ? "追加中..." : "追加する"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
