import { prisma } from "@/lib/prisma";
import { getStartOfWeek } from "@/lib/weekUtils";

export interface CategoryWeeklyDiaryProgress {
  categoryId: string;
  daysWritten: number;
  progressPercent: number; // 今週(月〜日)に日記を書いた日数 ÷ 7日
}

export async function computeWeeklyDiaryProgress(categoryId: string): Promise<CategoryWeeklyDiaryProgress> {
  const weekStart = getStartOfWeek(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const entries = await prisma.diaryEntry.findMany({
    where: { categoryId, date: { gte: weekStart, lt: weekEnd } },
    select: { date: true },
  });

  const daysWritten = new Set(entries.map((e) => e.date.toISOString().slice(0, 10))).size;

  return {
    categoryId,
    daysWritten,
    progressPercent: Math.round((daysWritten / 7) * 100),
  };
}
