"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

interface KeyAction {
  id: string;
  title: string;
  note: string;
  startDate: string | null;
  dueDate: string | null;
  sortOrder: number;
}

export function KeyActionList({ roadmapItemId, initialActions }: { roadmapItemId: string; initialActions: KeyAction[] }) {
  const router = useRouter();
  const [actions, setActions] = useState(initialActions);
  const [draftTitle, setDraftTitle] = useState("");
  const [showDraftDetail, setShowDraftDetail] = useState(false);
  const [draftNote, setDraftNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingNote, setEditingNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function addAction() {
    const title = draftTitle.trim();
    if (!title) return;
    setSaving(true);
    setError(null);

    const res = await fetch("/api/key-actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roadmapItemId,
        title,
        note: draftNote,
      }),
    });

    setSaving(false);
    if (!res.ok) {
      setError("追加に失敗しました。もう一度お試しください。");
      return;
    }
    const created = await res.json();
    setActions((prev) => [...prev, created]);
    setDraftTitle("");
    setDraftNote("");
    setShowDraftDetail(false);
    router.refresh();
  }

  function startEdit(action: KeyAction) {
    setEditingId(action.id);
    setEditingTitle(action.title);
    setEditingNote(action.note);
  }

  async function saveEdit(action: KeyAction) {
    const title = editingTitle.trim();
    if (!title) return;
    setError(null);

    const res = await fetch(`/api/key-actions/${action.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        note: editingNote,
      }),
    });

    if (!res.ok) {
      setError("保存に失敗しました。もう一度お試しください。");
      return;
    }
    const updated = await res.json();
    setActions((prev) => prev.map((a) => (a.id === action.id ? updated : a)));
    setEditingId(null);
    router.refresh();
  }

  async function removeAction(action: KeyAction) {
    setError(null);
    const res = await fetch(`/api/key-actions/${action.id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("削除に失敗しました。もう一度お試しください。");
      return;
    }
    setActions((prev) => prev.filter((a) => a.id !== action.id));
    router.refresh();
  }

  async function move(action: KeyAction, direction: -1 | 1) {
    const sorted = [...actions].sort((a, b) => a.sortOrder - b.sortOrder);
    const index = sorted.findIndex((a) => a.id === action.id);
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;
    const other = sorted[targetIndex];

    setError(null);
    const [res1, res2] = await Promise.all([
      fetch(`/api/key-actions/${action.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: other.sortOrder }),
      }),
      fetch(`/api/key-actions/${other.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: action.sortOrder }),
      }),
    ]);

    if (!res1.ok || !res2.ok) {
      setError("並び替えに失敗しました。");
      return;
    }
    const [u1, u2] = await Promise.all([res1.json(), res2.json()]);
    setActions((prev) => prev.map((a) => (a.id === u1.id ? u1 : a.id === u2.id ? u2 : a)));
    router.refresh();
  }

  const sorted = [...actions].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-medium text-slate-500">重点行動</div>
        {error && <span className="text-xs font-medium text-red-600">{error}</span>}
      </div>

      {sorted.length === 0 ? (
        <p className="mb-3 text-xs text-slate-400">まだ重点行動が登録されていません。</p>
      ) : (
        <ul className="mb-3 flex flex-col gap-1.5">
          {sorted.map((action, i) => (
            <li key={action.id} className="rounded-lg border border-slate-100 bg-slate-50/60 px-2 py-1.5">
              {editingId === action.id ? (
                <div className="flex flex-col gap-2">
                  <Input value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)} className="text-sm" autoFocus placeholder="行動タイトル" />
                  <Textarea value={editingNote} onChange={(e) => setEditingNote(e.target.value)} rows={2} className="text-xs" placeholder="行動の詳細" />
                  <div className="flex gap-2">
                    <Button type="button" variant="secondary" onClick={() => saveEdit(action)}>保存</Button>
                    <Button type="button" variant="secondary" onClick={() => setEditingId(null)}>取消</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <div className="flex shrink-0 flex-col pt-0.5">
                    <button type="button" onClick={() => move(action, -1)} disabled={i === 0} className="text-[10px] text-slate-400 hover:text-slate-700 disabled:opacity-20">▲</button>
                    <button type="button" onClick={() => move(action, 1)} disabled={i === sorted.length - 1} className="text-[10px] text-slate-400 hover:text-slate-700 disabled:opacity-20">▼</button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-slate-700">{action.title}</div>
                    {action.note && <div className="mt-0.5 whitespace-pre-wrap text-xs text-slate-500">{action.note}</div>}
                  </div>
                  <div className="flex shrink-0 gap-2 pt-0.5">
                    <button type="button" onClick={() => startEdit(action)} className="text-[11px] text-emerald-600 hover:text-emerald-700">編集</button>
                    <button type="button" onClick={() => removeAction(action)} className="text-[11px] text-slate-400 hover:text-red-500">削除</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 rounded-lg border border-dashed border-emerald-200 p-2">
        <Input
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          onFocus={() => setShowDraftDetail(true)}
          placeholder="重点行動タイトルを追加"
          className="text-sm"
        />
        {showDraftDetail && (
          <Textarea value={draftNote} onChange={(e) => setDraftNote(e.target.value)} rows={2} className="text-xs" placeholder="行動の詳細(任意)" />
        )}
        <Button type="button" variant="secondary" onClick={addAction} disabled={saving} className="w-full">
          追加
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        このフェーズの期間(計画ブロックで設定した月)に含まれる各月の「個別目標」に自動で反映されます。
      </p>
    </div>
  );
}
