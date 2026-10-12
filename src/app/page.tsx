import { prisma } from "@/lib/prisma";
import { connection } from "next/server";
import { computeWeeklyDiaryProgress } from "@/lib/weeklyDiaryProgress";
import { computeMarketValue } from "@/lib/marketValue/score";
import { evaluateStage } from "@/lib/marketValue/stages";
import { Card } from "@/components/ui/Card";
import { ProgressRingChart } from "@/components/dashboard/ProgressRingChart";
import { MarketValueCard } from "@/components/dashboard/MarketValueCard";
import { WeeklyTodoList } from "@/components/dashboard/WeeklyTodoList";
import { RecommendedTasks } from "@/components/dashboard/RecommendedTasks";
import { DailyPhilosophyQuote } from "@/components/dashboard/DailyPhilosophyQuote";
import { DailyEnglishWord } from "@/components/dashboard/DailyEnglishWord";
import { TodayBookRecommendation } from "@/components/dashboard/TodayBookRecommendation";
import { getStartOfWeek } from "@/lib/weekUtils";
import { ensureTodayArchived } from "@/lib/dailyArchive";

export default async function DashboardPage() {
  await connection();

  const categories = await prisma.category.findMany({ orderBy: { sortOrder: "asc" } });
  const progresses = await Promise.all(categories.map((c) => computeWeeklyDiaryProgress(c.id)));
  await ensureTodayArchived(categories, progresses);

  const marketValueData = await computeMarketValue();
  const stageEval = evaluateStage(marketValueData);
  const latestSnapshot = await prisma.marketValueScoreSnapshot.findFirst({
    orderBy: { computedAt: "desc" },
  });

  const now = new Date();
  const weeklyTodoStart = getStartOfWeek(now);
  const weeklyTodos = await prisma.weeklyTodoItem.findMany({
    where: { weekStart: weeklyTodoStart },
    include: {
      roadmapItem: { select: { id: true, title: true, categoryId: true } },
      individualGoal: { select: { id: true, title: true, categoryId: true } },
    },
    orderBy: [{ dayOfWeek: "asc" }, { isDone: "asc" }, { createdAt: "asc" }],
  });

  const linkableRoadmapItems = await prisma.roadmapItem.findMany({
    where: { status: { not: "DONE" } },
    select: { id: true, title: true, categoryId: true },
    orderBy: { title: "asc" },
  });

  const linkableGoals = await prisma.individualGoal.findMany({
    where: { syncDeleted: false, status: { not: "DONE" } },
    select: { id: true, title: true, categoryId: true },
    orderBy: { title: "asc" },
  });

  const recommendedGoals = await prisma.individualGoal.findMany({
    where: { syncDeleted: false, status: { not: "DONE" }, priority: "HIGH", dueDate: { not: null } },
    select: { id: true, title: true, categoryId: true, dueDate: true },
    orderBy: { dueDate: "asc" },
  });

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-slate-900">ダッシュボード</h1>

      <DailyPhilosophyQuote />
      <DailyEnglishWord />
      <TodayBookRecommendation categories={categories} progresses={progresses} />

      <Card className="border-emerald-100 bg-gradient-to-br from-emerald-50/80 via-white to-lime-50 shadow-[0_20px_45px_rgba(16,185,129,0.08)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">3領域の進捗(今週)</h2>
            <p className="mt-1 text-xs text-slate-500">今週(月〜日)、その領域で日記を書いた日数 ÷ 7日。週が変わると自動でリセットされます。</p>
          </div>
          <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">🌱 成長中</span>
        </div>
        <div className="flex flex-wrap justify-around gap-6">
          {categories.map((c, i) => (
            <ProgressRingChart
              key={c.id}
              value={progresses[i].progressPercent}
              color={c.color}
              label={c.label}
              categoryId={c.id}
            />
          ))}
        </div>
      </Card>

      <MarketValueCard
        score={marketValueData.normalizedScore}
        previousScore={latestSnapshot?.totalScore ?? null}
        stageLevel={stageEval.currentLevel}
        stageTitle={stageEval.currentTitle}
        nextStageTitle={stageEval.nextStage?.title ?? null}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-slate-600">ウィークリーToDo</h2>
          <WeeklyTodoList
            initialItems={weeklyTodos}
            roadmapItems={linkableRoadmapItems}
            individualGoals={linkableGoals}
            categories={categories}
          />
        </Card>
        <Card className="border-amber-100 bg-gradient-to-br from-amber-50/80 via-white to-amber-50/40">
          <RecommendedTasks
            categories={categories.map((c) => ({ id: c.id, label: c.label, color: c.color }))}
            goals={recommendedGoals
              .filter((g) => g.dueDate !== null)
              .map((g) => ({ id: g.id, title: g.title, categoryId: g.categoryId, dueDate: g.dueDate!.toISOString() }))}
          />
        </Card>
      </div>
    </div>
  );
}
