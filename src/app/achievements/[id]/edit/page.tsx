import { Suspense } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AchievementForm } from "@/components/achievements/AchievementForm";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { BackButton } from "@/components/ui/BackButton";
import { getSkillSuggestions } from "@/lib/skillSuggestions";

export default async function EditAchievementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [categories, achievement, individualGoals, skillSuggestions] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.achievement.findUnique({ where: { id }, include: { axisLinks: true } }),
    prisma.individualGoal.findMany({
      where: { syncDeleted: false },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    getSkillSuggestions(),
  ]);

  if (!achievement) notFound();

  return (
    <div className="max-w-2xl">
      <BackButton />
      <h1 className="mb-6 text-2xl font-bold text-slate-900">実績を編集</h1>
      <Suspense>
        <AchievementForm
          categories={categories}
          initial={achievement}
          individualGoals={individualGoals}
          skillSuggestions={skillSuggestions}
        />
      </Suspense>
      <div className="mt-4 flex justify-end">
        <DeleteButton apiPath={`/api/achievements/${achievement.id}`} redirectTo="/achievements" />
      </div>
    </div>
  );
}
