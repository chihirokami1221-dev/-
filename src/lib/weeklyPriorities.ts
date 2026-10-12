import { prisma } from "@/lib/prisma";
import { daysUntil } from "@/lib/dateUtils";

export interface PriorityItem {
  id: string;
  title: string;
  categoryId: string;
  dueDate: Date | null;
  priority: string;
  reasonTags: string[]; // なぜ優先なのかを示すタグ(「期限が近いから」だけで決めない複数要因を提示)
}

const PRIORITY_WEIGHT: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

// 期限の近さ・優先度・停滞期間(更新が止まっている期間)を組み合わせて算出する。
// 「期限が近いから」という単一要因だけで優先しない。
export async function computeWeeklyPriorities(limit = 3): Promise<PriorityItem[]> {
  const items = await prisma.roadmapItem.findMany({
    where: { status: { in: ["NOT_STARTED", "IN_PROGRESS", "ON_HOLD"] } },
  });

  const now = new Date();

  const scored = items.map((item) => {
    const reasonTags: string[] = [];

    let urgencyScore = 0;
    if (item.dueDate) {
      const remaining = daysUntil(item.dueDate);
      if (remaining <= 14) {
        urgencyScore = Math.max(0, 14 - remaining) * 2;
        reasonTags.push("期限が近い");
      }
    }

    const priorityScore = (PRIORITY_WEIGHT[item.priority] ?? 1) * 5;
    if (item.priority === "HIGH") reasonTags.push("優先度が高い");

    const stagnationDays = Math.floor((now.getTime() - item.updatedAt.getTime()) / (1000 * 60 * 60 * 24));
    const stagnationScore = stagnationDays >= 14 ? 10 : stagnationDays >= 7 ? 5 : 0;
    if (stagnationScore > 0) reasonTags.push("更新が停滞している");

    const totalScore = urgencyScore + priorityScore + stagnationScore;

    return { item, totalScore, reasonTags };
  });

  scored.sort((a, b) => b.totalScore - a.totalScore);

  return scored.slice(0, limit).map(({ item, reasonTags }) => ({
    id: item.id,
    title: item.title,
    categoryId: item.categoryId,
    dueDate: item.dueDate,
    priority: item.priority,
    reasonTags,
  }));
}
