"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { KeyActionList } from "@/components/roadmap/KeyActionList";
import { formatJP } from "@/lib/dateUtils";
import { generateMonthOptions, monthToDateRange, dateToMonthValue, formatPhasePeriod } from "@/lib/monthOptions";

const MONTH_OPTIONS = generateMonthOptions();

interface KeyAction {
  id: string;
  title: string;
  note: string;
  startDate: string | null;
  dueDate: string | null;
  sortOrder: number;
}

interface Phase {
  id: string;
  title: string;
  startDate: string | null;
  dueDate: string | null;
  keyActions: KeyAction[];
}

// 計画ブロック(フェーズ)を、このロードマップ画面の中だけでタイトル・時期を編集・削除できるようにする。
// 行動(重点行動)もこのカードの中に直接内包し、別タブへ移動させない。
export function PhaseEditor({ phase }: { phase: Phase }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(phase.title);
  const [month, setMonth] = useState(dateToMonthValue(phase.startDate));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    const { startDate, dueDate } = month ? monthToDateRange(month) : { startDate: null, dueDate: null };
    const res = await fetch(`/api/roadmap/${phase.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        startDate,
        dueDate,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("保存に失敗しました。もう一度お試しください。");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  return (
    <div id={phase.id} className="rounded-2xl border border-slate-200 bg-white p-4">
      {error && <p className="mb-2 text-xs font-medium text-red-600">{error}</p>}

      {editing ? (
        <div className="mb-3 flex flex-col gap-2">
          <Select value={month} onChange={(e) => setMonth(e.target.value)} className="text-sm">
            <option value="">時期(任意)</option>
            {MONTH_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="text-base font-semibold" placeholder="計画ブロックのタイトル" autoFocus />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditing(false)} disabled={saving}>キャンセル</Button>
            <Button type="button" onClick={save} disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
          </div>
        </div>
      ) : (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900">{phase.title}</h3>
            <p className="text-sm text-slate-500">{formatPhasePeriod(phase.startDate, phase.dueDate, formatJP)}</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setEditing(true)} className="text-xs text-emerald-600 hover:text-emerald-700">編集</button>
            <DeleteButton apiPath={`/api/roadmap/${phase.id}`} redirectTo="/roadmap" confirmMessage="この計画ブロックを削除しますか？紐づく重点行動も削除されます(個別目標・実績の履歴は保護されます)。" />
          </div>
        </div>
      )}

      <KeyActionList roadmapItemId={phase.id} initialActions={phase.keyActions} />
    </div>
  );
}
