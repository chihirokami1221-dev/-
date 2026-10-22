"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { getStartOfWeek, getWeekLabel } from "@/lib/weekUtils";

interface RoadmapItemOption {
  id: string;
  title: string;
  categoryId: string;
}

interface IndividualGoalOption {
  id: string;
  title: string;
  categoryId: string;
}

interface WeeklyTodoItem {
  id: string;
  title: string;
  isDone: boolean;
  priority: "HIGH" | "MEDIUM" | "LOW";
  dayOfWeek: "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";
  roadmapItemId?: string | null;
  roadmapItem?: RoadmapItemOption | null;
  individualGoalId?: string | null;
  individualGoal?: { id: string; title: string; categoryId: string } | null;
}

interface CategoryOption {
  id: string;
  label: string;
  color: string;
}

const DAYS = [
  { key: "MON", shortLabel: "月" },
  { key: "TUE", shortLabel: "火" },
  { key: "WED", shortLabel: "水" },
  { key: "THU", shortLabel: "木" },
  { key: "FRI", shortLabel: "金" },
  { key: "SAT", shortLabel: "土" },
  { key: "SUN", shortLabel: "日" },
] as const;

export function WeeklyTodoList({
  initialItems,
  roadmapItems = [],
  individualGoals = [],
  categories = [],
}: {
  initialItems: WeeklyTodoItem[];
  roadmapItems?: RoadmapItemOption[];
  individualGoals?: IndividualGoalOption[];
  categories?: CategoryOption[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  // initialItems(サーバーから渡される最新データ)が変わった時点でitemsへ反映する。
  // useEffectではなく、レンダー中にstateを直接調整する(Reactが公式に推奨する
  // 「propが変わったらstateを調整する」パターン)ことで、1回余分な再レンダーが
  // 発生する問題を避ける。
  const [prevInitialItems, setPrevInitialItems] = useState(initialItems);
  if (initialItems !== prevInitialItems) {
    setPrevInitialItems(initialItems);
    setItems(initialItems);
  }
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editingLink, setEditingLink] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // 優先事項・ダッシュボードなど同じページ内の他セクションはサーバーで再計算されるため、
  // 保存成功のたびにrouter.refresh()でページ全体のサーバーデータを更新する。
  function handleError(message: string) {
    setError(message);
  }

  const weekLabel = getWeekLabel(new Date());
  const weekStart = useMemo(() => getStartOfWeek(new Date()), []);
  const remaining = useMemo(() => items.filter((item) => !item.isDone).length, [items]);

  const grouped = useMemo(
    () =>
      DAYS.map((day, index) => {
        const date = new Date(weekStart.getTime() + index * 24 * 60 * 60 * 1000);
        return {
          ...day,
          label: `${date.getMonth() + 1}/${date.getDate()}(${day.shortLabel})`,
          items: items.filter((item) => item.dayOfWeek === day.key),
        };
      }),
    [items, weekStart],
  );

  async function createItem(
    dayKey: WeeklyTodoItem["dayOfWeek"],
    title: string,
    links: { roadmapItemId?: string | null; individualGoalId?: string | null } = {},
  ) {
    setError(null);

    const res = await fetch("/api/weekly-todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        priority: "MEDIUM",
        dayOfWeek: dayKey,
        weekStart: getStartOfWeek(new Date()).toISOString(),
        roadmapItemId: links.roadmapItemId ?? null,
        individualGoalId: links.individualGoalId ?? null,
      }),
    });

    if (!res.ok) {
      handleError("予定の追加に失敗しました。もう一度お試しください。");
      return;
    }

    const created = await res.json();
    const linkedRoadmap = roadmapItems.find((r) => r.id === created.roadmapItemId) ?? null;
    const linkedGoal = individualGoals.find((g) => g.id === created.individualGoalId) ?? null;
    setItems((prev) => [...prev, { ...created, roadmapItem: linkedRoadmap, individualGoal: linkedGoal }]);
    setDrafts((prev) => ({ ...prev, [dayKey]: "" }));
    router.refresh();
  }

  async function addItem(dayKey: WeeklyTodoItem["dayOfWeek"]) {
    const value = (drafts[dayKey] ?? "").trim();
    if (!value) return;
    await createItem(dayKey, value);
  }

  // 個別目標を選んだ時点で、入力中のタイトルがあればそれを、なければ目標名をタイトルにして即追加する。
  async function addItemFromGoalSelect(dayKey: WeeklyTodoItem["dayOfWeek"], individualGoalId: string) {
    if (!individualGoalId) return;
    const typed = (drafts[dayKey] ?? "").trim();
    const goal = individualGoals.find((g) => g.id === individualGoalId);
    const title = typed || goal?.title;
    if (!title) return;
    await createItem(dayKey, title, { individualGoalId });
  }

  async function saveEdit(item: WeeklyTodoItem) {
    const value = editingText.trim();
    if (!value) return;
    setError(null);

    const res = await fetch(`/api/weekly-todos/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: value, roadmapItemId: editingLink || null }),
    });

    if (!res.ok) {
      handleError("保存に失敗しました。もう一度お試しください。");
      return;
    }

    const updated = await res.json();
    const linked = roadmapItems.find((r) => r.id === updated.roadmapItemId) ?? null;
    setItems((prev) => prev.map((current) => (current.id === item.id ? { ...updated, roadmapItem: linked } : current)));
    setEditingId(null);
    setEditingText("");
    setEditingLink("");
    router.refresh();
  }

  async function toggleDone(item: WeeklyTodoItem) {
    setError(null);
    const res = await fetch(`/api/weekly-todos/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDone: !item.isDone }),
    });

    if (!res.ok) {
      handleError("更新に失敗しました。もう一度お試しください。");
      return;
    }

    const updated = await res.json();
    setItems((prev) => prev.map((current) => (current.id === item.id ? updated : current)));
    router.refresh();
  }

  async function updatePriority(item: WeeklyTodoItem, priority: WeeklyTodoItem["priority"]) {
    setError(null);
    const res = await fetch(`/api/weekly-todos/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority }),
    });

    if (!res.ok) {
      handleError("優先度の変更に失敗しました。もう一度お試しください。");
      return;
    }

    const updated = await res.json();
    setItems((prev) => prev.map((current) => (current.id === item.id ? updated : current)));
    router.refresh();
  }

  async function removeItem(item: WeeklyTodoItem) {
    setError(null);
    const res = await fetch(`/api/weekly-todos/${item.id}`, { method: "DELETE" });
    if (!res.ok) {
      handleError("削除に失敗しました。もう一度お試しください。");
      return;
    }
    setItems((prev) => prev.filter((current) => current.id !== item.id));
    router.refresh();
  }

  async function moveItemToDay(itemId: string, targetDay: WeeklyTodoItem["dayOfWeek"]) {
    if (!itemId) return;
    const item = items.find((entry) => entry.id === itemId);
    if (!item) return;
    setError(null);

    const res = await fetch(`/api/weekly-todos/${itemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dayOfWeek: targetDay }),
    });

    if (!res.ok) {
      handleError("曜日の変更に失敗しました。もう一度お試しください。");
      return;
    }

    const updated = await res.json();
    setItems((prev) => prev.map((current) => (current.id === itemId ? updated : current)));
    router.refresh();
  }

  const priorityStyles: Record<WeeklyTodoItem["priority"], string> = {
    HIGH: "bg-red-100 text-red-700 ring-red-200",
    MEDIUM: "bg-amber-100 text-amber-700 ring-amber-200",
    LOW: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-100 via-lime-50 to-amber-50 px-3 py-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">Weekly plan</div>
          <div className="text-lg font-black text-slate-800">{weekLabel}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
          {remaining}/{items.length || 0} 残り
        </span>
        {error && <span className="text-xs font-medium text-red-600">{error}</span>}
      </div>

      <div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {grouped.map(({ key, label, items: dayItems }) => (
            <div
              key={key}
              className="min-h-[190px] rounded-2xl border border-slate-200 bg-slate-50/80 p-2 shadow-sm"
              onDragOver={(e) => e.preventDefault()}
              onDrop={async (e) => {
                e.preventDefault();
                const itemId = e.dataTransfer.getData("text/plain");
                if (itemId) {
                  await moveItemToDay(itemId, key);
                }
                setDraggedId(null);
              }}
            >
              <div className="mb-3 rounded-xl bg-slate-200/80 px-2 py-2 text-center text-sm font-bold text-slate-700">
                {label}
              </div>

              <div className="space-y-2">
                {dayItems.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-white/50 p-2 text-[11px] text-slate-400">
                    予定なし
                  </div>
                ) : (
                  dayItems.map((item) => (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", item.id);
                        setDraggedId(item.id);
                      }}
                      onDragEnd={() => setDraggedId(null)}
                      className={`rounded-xl border border-slate-200 bg-white px-2 py-2 shadow-sm ${draggedId === item.id ? "opacity-60" : "opacity-100"}`}
                    >
                      <div className="mb-1 flex items-center gap-1">
                        <input
                          type="checkbox"
                          draggable={false}
                          checked={item.isDone}
                          onChange={() => toggleDone(item)}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                          className="h-5 w-5 accent-emerald-500"
                        />
                        <Select
                          aria-label="優先度"
                          value={item.priority}
                          onChange={(e) => updatePriority(item, e.target.value as WeeklyTodoItem["priority"])}
                          className={`w-auto rounded-full px-1.5 py-0.5 text-[9px] font-semibold ring-1 ${priorityStyles[item.priority]}`}
                        >
                          <option value="HIGH">高</option>
                          <option value="MEDIUM">中</option>
                          <option value="LOW">低</option>
                        </Select>
                      </div>

                      {editingId === item.id ? (
                        <div className="space-y-2">
                          <Input
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                saveEdit(item);
                              }
                            }}
                            autoFocus
                            className="text-sm"
                          />
                          <Select
                            aria-label="関連するロードマップ項目"
                            value={editingLink}
                            onChange={(e) => setEditingLink(e.target.value)}
                            className="text-xs"
                          >
                            <option value="">ロードマップに紐づけない</option>
                            {roadmapItems.map((r) => (
                              <option key={r.id} value={r.id}>
                                {categoryById.get(r.categoryId)?.label ?? ""}: {r.title}
                              </option>
                            ))}
                          </Select>
                          <div className="flex gap-2">
                            <Button type="button" variant="secondary" onClick={() => saveEdit(item)} className="flex-1">
                              保存
                            </Button>
                            <Button type="button" variant="secondary" onClick={() => setEditingId(null)} className="flex-1">
                              キャンセル
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className={`text-sm ${item.isDone ? "text-slate-400 line-through" : "text-slate-700"}`}>
                            {item.title}
                          </div>
                          {item.roadmapItem && (
                            <Link
                              href={`/roadmap/${item.roadmapItem.id}`}
                              className="mt-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
                              style={{
                                backgroundColor: `${categoryById.get(item.roadmapItem.categoryId)?.color ?? "#94a3b8"}22`,
                                color: categoryById.get(item.roadmapItem.categoryId)?.color ?? "#64748b",
                              }}
                            >
                              🔗 {item.roadmapItem.title}
                            </Link>
                          )}
                          <Select
                            aria-label={`${item.title}の曜日を変更`}
                            value={item.dayOfWeek}
                            onChange={(e) => moveItemToDay(item.id, e.target.value as WeeklyTodoItem["dayOfWeek"])}
                            className="mt-2 md:hidden"
                          >
                            {DAYS.map((day) => <option key={day.key} value={day.key}>{day.shortLabel}曜日へ移動</option>)}
                          </Select>
                          <div className="mt-1 flex items-center justify-between gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(item.id);
                                setEditingText(item.title);
                                setEditingLink(item.roadmapItemId ?? "");
                              }}
                              className="text-[10px] text-emerald-600 hover:text-emerald-700"
                            >
                              編集
                            </button>
                            <button
                              type="button"
                              onClick={() => removeItem(item)}
                              className="text-[10px] text-slate-400 hover:text-red-500"
                            >
                              削除
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="mt-3 space-y-2 rounded-xl border border-dashed border-emerald-200 bg-white/60 p-2">
                <Input
                  value={drafts[key] ?? ""}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addItem(key);
                    }
                  }}
                  placeholder="予定を追加(Enterで追加)"
                  className="text-sm"
                />
                {individualGoals.length > 0 && (
                  <Select
                    aria-label="個別目標から追加"
                    value=""
                    onChange={(e) => addItemFromGoalSelect(key, e.target.value)}
                    className="text-[10px]"
                  >
                    <option value="">個別目標から選んで追加</option>
                    {individualGoals.map((g) => (
                      <option key={g.id} value={g.id}>
                        {categoryById.get(g.categoryId)?.label ?? ""}: {g.title}
                      </option>
                    ))}
                  </Select>
                )}
                <Button type="button" variant="secondary" onClick={() => addItem(key)} className="w-full border-emerald-200 bg-emerald-500 text-white hover:bg-emerald-600">
                  追加
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
