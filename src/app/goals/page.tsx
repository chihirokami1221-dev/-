import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/Badge";
import { IndividualGoalCard } from "@/components/goals/IndividualGoalCard";
import { NewGoalForm } from "@/components/goals/NewGoalForm";

type Priority = "HIGH" | "MEDIUM" | "LOW";
type GoalRow = Awaited<ReturnType<typeof loadGoals>>[number];

function priorityRank(p: Priority): number {
  return p === "HIGH" ? 0 : p === "MEDIUM" ? 1 : 2;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}

// 同じ月の中では優先度(高→中→低)順。優先度が同じ場合は期限が近い順、期限なし同士は登録順。
function sortByPriority(goals: GoalRow[]): GoalRow[] {
  return [...goals].sort((a, b) => {
    const pr = priorityRank(a.priority) - priorityRank(b.priority);
    if (pr !== 0) return pr;
    if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime();
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

async function loadGoals() {
  return prisma.individualGoal.findMany({
    where: { syncDeleted: false },
    include: {
      category: true,
      roadmapItem: { select: { id: true, title: true } },
      keyAction: { select: { id: true, title: true } },
    },
  });
}

export default async function GoalsPage({
  searchParams,
}: {
  searchParams: Promise<{ categoryId?: string }>;
}) {
  await connection();
  const { categoryId } = await searchParams;

  const categories = await prisma.category.findMany({ orderBy: { sortOrder: "asc" } });
  const allGoals = await loadGoals();
  const goals = categoryId ? allGoals.filter((g) => g.categoryId === categoryId) : allGoals;
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  // targetMonth = ロードマップの計画ブロックで登録された月(手動登録した目標は期限の月、期限未入力なら登録月)。
  // ただしロードマップ連携のない(keyActionIdなし)手動目標で期限も未入力のものは、月に紐づかない
  // 「期間未設定」枠として別扱いにする(targetMonthは内部キーとして自動で今月が入っているだけなので)。
  const unsetGoals: GoalRow[] = [];
  const monthMap = new Map<string, GoalRow[]>();
  for (const g of goals) {
    if (!g.keyActionId && !g.dueDate) {
      unsetGoals.push(g);
      continue;
    }
    const key = monthKey(g.targetMonth);
    if (!monthMap.has(key)) monthMap.set(key, []);
    monthMap.get(key)!.push(g);
  }

  const sections: { key: string; label: string; goals: GoalRow[] }[] = [];
  if (unsetGoals.length > 0) sections.push({ key: "unset", label: "期間未設定", goals: sortByPriority(unsetGoals) });
  for (const key of [...monthMap.keys()].sort()) {
    const [y, m] = key.split("-").map(Number);
    sections.push({ key, label: monthLabel(new Date(y, m - 1, 1)), goals: sortByPriority(monthMap.get(key)!) });
  }

  return (
    <div className="max-w-5xl">
      <h1 className="mb-2 text-2xl font-bold text-slate-900">個別目標</h1>
      <p className="mb-6 text-sm text-slate-500">
        ロードマップのフェーズに登録した「重点行動」から、対象月ごとに自動生成されます。自由に編集・削除でき、手動編集した内容は自動同期で上書きされません。ロードマップを経由せず、ここから直接目標を追加することもできます。ロードマップで登録されている月ごとに区分し、各月の中は優先度(高→中→低)の順に並びます。
      </p>

      <div className="mb-4 flex gap-2">
        <Link
          href="/goals"
          className={`rounded-full px-3 py-1 text-sm ${
            !categoryId ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-600"
          }`}
        >
          すべて
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/goals?categoryId=${c.id}`}
            className={`rounded-full px-3 py-1 text-sm ${
              categoryId === c.id ? "text-white" : "border border-slate-300 bg-white text-slate-600"
            }`}
            style={categoryId === c.id ? { backgroundColor: c.color } : undefined}
          >
            {c.label}
          </Link>
        ))}
      </div>

      <NewGoalForm categories={categories.map((c) => ({ id: c.id, label: c.label }))} />

      {sections.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
          個別目標がまだありません。ロードマップの各フェーズに「重点行動」を登録すると自動で表示されるほか、上の「+ 目標を追加」からも直接登録できます。
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          {sections.map((section) => (
            <div key={section.key}>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-700">{section.label}</h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                  {section.goals.length}件
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {section.goals.map((g) => (
                  <div key={g.id}>
                    {!categoryId && (
                      <div className="mb-1">
                        <Badge color={categoryById.get(g.categoryId)?.color ?? "#94a3b8"}>
                          {categoryById.get(g.categoryId)?.label ?? ""}
                        </Badge>
                      </div>
                    )}
                    <IndividualGoalCard
                      goal={{
                        ...g,
                        dueDate: g.dueDate ? g.dueDate.toISOString() : null,
                      }}
                      categoryColor={categoryById.get(g.categoryId)?.color ?? "#94a3b8"}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
