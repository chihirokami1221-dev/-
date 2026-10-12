import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { AchievementForm } from "@/components/achievements/AchievementForm";
import { BackButton } from "@/components/ui/BackButton";

export default async function NewAchievementPage() {
  const [categories, individualGoals] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.individualGoal.findMany({
      where: { syncDeleted: false },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
  ]);

  return (
    <div className="max-w-2xl">
      <BackButton />
      <h1 className="mb-6 text-2xl font-bold text-slate-900">実績を登録</h1>
      <Suspense>
        <AchievementForm categories={categories} individualGoals={individualGoals} />
      </Suspense>
    </div>
  );
}
