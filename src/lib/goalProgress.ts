import { prisma } from "@/lib/prisma";

export interface CategoryGoalProgress {
  categoryId: string;
  totalGoals: number;
  doneGoals: number;
  progressPercent: number | null; // nullは個別目標が1件もない(未設定)
}

// そのカテゴリの個別目標のうち、完了(DONE)の割合を進捗として返す。
// 日記の記入日数とは無関係(目標の達成度のみを反映する)。
export async function computeCategoryGoalProgress(categoryId: string): Promise<CategoryGoalProgress> {
  const goals = await prisma.individualGoal.findMany({
    where: { categoryId, syncDeleted: false },
    select: { status: true },
  });

  if (goals.length === 0) {
    return { categoryId, totalGoals: 0, doneGoals: 0, progressPercent: null };
  }

  const doneGoals = goals.filter((g) => g.status === "DONE").length;
  return {
    categoryId,
    totalGoals: goals.length,
    doneGoals,
    progressPercent: Math.round((doneGoals / goals.length) * 100),
  };
}
