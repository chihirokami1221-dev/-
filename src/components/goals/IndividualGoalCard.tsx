"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { getStartOfWeek } from "@/lib/weekUtils";

interface Goal {
  id: string;
  title: string;
  content: string;
  dueDate: string | null;
  status: "NOT_STARTED" | "IN_PROGRESS" | "ON_HOLD" | "DONE";
  priority: "HIGH" | "MEDIUM" | "LOW";
  progressPercent: number;
  manuallyEdited: boolean;
  roadmapItem: { id: string; title: string } | null;
  keyAction: { id: string; title: string } | null;
}

const STATUS_LABEL: Record<Goal["status"], string> = {
  NOT_STARTED: "未着手",
  IN_PROGRESS: "進行中",
  ON_HOLD: "保留",
  DONE: "完了",
};

const PRIORITY_LABEL: Record<Goal["priority"], string> = { HIGH: "優先度:高", MEDIUM: "優先度:中", LOW: "優先度:低" };

const PRIORITY_STYLE: Record<Goal["priority"], string> = {
  HIGH: "bg-red-50 text-red-700 ring-1 ring-red-200",
  MEDIUM: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  LOW: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
};

const DAY_OPTIONS = [
  { key: "MON", label: "月" },
  { key: "TUE", label: "火" },
  { key: "WED", label: "水" },
  { key: "THU", label: "木" },
  { key: "FRI", label: "金" },
  { key: "SAT", label: "土" },
  { key: "SUN", label: "日" },
] as const;

export function IndividualGoalCard({ goal, categoryColor }: { goal: Goal; categoryColor: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(goal.title);
  const [content, setContent] = useState(goal.content);
  const [dueDate, setDueDate] = useState(goal.dueDate ? goal.dueDate.slice(0, 10) : "");
  const [error, setError] = useState<string | null>(null);
  const [addDay, setAddDay] = useState("");

  const isOverdue = goal.dueDate && goal.status !== "DONE" && new Date(goal.dueDate) < new Date();

  async function patch(data: Record<string, unknown>) {
    setError(null);
    const res = await fetch(`/api/individual-goals/${goal.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      setError("更新に失敗しました。");
      return false;
    }
    router.refresh();
    return true;
  }

  async function saveEdit() {
    const ok = await patch({ title: title.trim(), content, dueDate: dueDate || null });
    if (ok) setEditing(false);
  }

  async function remove() {
    setError(null);
    const res = await fetch(`/api/individual-goals/${goal.id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("削除に失敗しました。");
      return;
    }
    router.refresh();
  }

  async function addToWeeklyTodo() {
    if (!addDay) return;
    setError(null);
    const res = await fetch("/api/weekly-todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: goal.title,
        priority: "MEDIUM",
        dayOfWeek: addDay,
        weekStart: getStartOfWeek(new Date()).toISOString(),
        individualGoalId: goal.id,
      }),
    });
    if (!res.ok) {
      setError("ウィークリーToDoへの追加に失敗しました。");
      return;
    }
    setAddDay("");
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3" style={{ borderLeftWidth: 4, borderLeftColor: categoryColor }}>
      {error && <p className="mb-2 text-xs font-medium text-red-600">{error}</p>}

      {editing ? (
        <div className="flex flex-col gap-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="text-sm" />
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} className="text-xs" placeholder="具体的な行動(箇条書き可)" />
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-40 text-xs" />
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={saveEdit}>保存</Button>
            <Button type="button" variant="secondary" onClick={() => setEditing(false)}>キャンセル</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-1 flex items-start justify-between gap-2">
            <div className="text-sm font-semibold text-slate-800">{goal.title}</div>
            <div className="flex shrink-0 gap-2">
              <button type="button" onClick={() => setEditing(true)} className="text-[11px] text-emerald-600 hover:text-emerald-700">編集</button>
              <button type="button" onClick={remove} className="text-[11px] text-slate-400 hover:text-red-500">削除</button>
            </div>
          </div>

          {goal.content && <p className="mb-2 whitespace-pre-wrap text-xs text-slate-600">{goal.content}</p>}

          <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            {goal.roadmapItem && (
              <Link href={`/roadmap/${goal.roadmapItem.id}`} className="rounded-full bg-slate-100 px-2 py-0.5 hover:bg-slate-200">
                🔗 {goal.roadmapItem.title}
              </Link>
            )}
            {goal.dueDate && (
              <span className={isOverdue ? "font-semibold text-red-600" : ""}>
                期限: {new Date(goal.dueDate).toLocaleDateString("ja-JP")}
                {isOverdue && " (期限超過)"}
              </span>
            )}
            {goal.manuallyEdited && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-600">手動編集済み</span>}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="状態"
              value={goal.status}
              onChange={(e) => patch({ status: e.target.value })}
              className="w-auto text-xs"
            >
              {Object.entries(STATUS_LABEL).map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </Select>
            <Select
              aria-label="優先度"
              value={goal.priority}
              onChange={(e) => patch({ priority: e.target.value })}
              className={`w-auto rounded-full px-2 py-1 text-xs font-semibold ${PRIORITY_STYLE[goal.priority]}`}
            >
              {Object.entries(PRIORITY_LABEL).map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </Select>

            <div className="ml-auto flex items-center gap-1">
              <Select aria-label="曜日を選んでToDoに追加" value={addDay} onChange={(e) => setAddDay(e.target.value)} className="w-auto text-[10px]">
                <option value="">今週のToDoに追加...</option>
                {DAY_OPTIONS.map((d) => (
                  <option key={d.key} value={d.key}>{d.label}曜日</option>
                ))}
              </Select>
              {addDay && (
                <Button type="button" variant="secondary" onClick={addToWeeklyTodo} className="text-[10px]">
                  追加
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
