"use client";

import { useState } from "react";
import Link from "next/link";
import { formatJP } from "@/lib/dateUtils";

interface CategoryOption {
  id: string;
  label: string;
  color: string;
}

interface RecommendedGoal {
  id: string;
  title: string;
  dueDate: string | null; // 期限なしでも「今月が対象月」なら渡される
  categoryId: string;
}

// 優先度「高」の個別目標を「おすすめタスク」として、カテゴリー(本業/副業/音楽)タブで切り替えて表示する。
// 期限つきのものは期限が近い順、期限なし(今月が対象月)のものはその後ろに表示する。
export function RecommendedTasks({
  categories,
  goals,
}: {
  categories: CategoryOption[];
  goals: RecommendedGoal[];
}) {
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");

  const filtered = goals
    .filter((g) => g.categoryId === categoryId)
    .sort((a, b) => {
      if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    });

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-700">おすすめタスク</div>
        <p className="mt-0.5 text-xs text-slate-500">優先度「高」の個別目標です(期限つき、または今月が対象月のもの)。</p>
      </div>

      <div className="flex gap-1">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategoryId(c.id)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              categoryId === c.id ? "text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
            style={categoryId === c.id ? { backgroundColor: c.color } : undefined}
          >
            {c.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white/60 p-4 text-center text-xs text-slate-400">
          このカテゴリーには優先度「高」の目標がありません。
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((g) => {
            const isOverdue = g.dueDate !== null && new Date(g.dueDate) < new Date();
            return (
              <li key={g.id}>
                <Link
                  href="/goals"
                  className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2 hover:bg-amber-50"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{g.title}</span>
                  <span className={`shrink-0 text-xs font-semibold ${isOverdue ? "text-red-600" : "text-amber-700"}`}>
                    {g.dueDate ? formatJP(new Date(g.dueDate)) : "今月"}
                    {isOverdue && "(超過)"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
