import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { AchievementForm } from "@/components/achievements/AchievementForm";
import { BackButton } from "@/components/ui/BackButton";
import { getSkillSuggestions } from "@/lib/skillSuggestions";

export default async function NewAchievementPage() {
  const [categories, individualGoals, skillSuggestions] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.individualGoal.findMany({
      where: { syncDeleted: false },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    getSkillSuggestions(),
  ]);

  return (
    <div className="max-w-2xl">
      <BackButton />
      <h1 className="mb-6 text-2xl font-bold text-slate-900">実績を登録</h1>
      <Suspense>
        <AchievementForm categories={categories} individualGoals={individualGoals} skillSuggestions={skillSuggestions} />
      </Suspense>
    </div>
  );
}
