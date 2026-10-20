import { prisma } from "@/lib/prisma";

// 月の1日0時(ローカルタイム)に正規化する。対象月の識別キーとして使う。
function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function addMonths(date: Date, n: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + n, 1, 0, 0, 0, 0);
}

// フェーズ(RoadmapItem)の開始日・終了日から、対象となる月(各月1日)のリストを求める。
// 日付が未設定のフェーズは対象月なし(個別目標は生成しない)。
export function computeTargetMonths(startDate: Date | null, dueDate: Date | null): Date[] {
  if (!startDate || !dueDate) return [];
  const months: Date[] = [];
  let cursor = monthStart(startDate);
  const end = monthStart(dueDate);
  let guard = 0;
  while (cursor.getTime() <= end.getTime() && guard < 60) {
    months.push(cursor);
    cursor = addMonths(cursor, 1);
    guard++;
  }
  return months;
}

// 指定したフェーズ(RoadmapItem)に紐づく重点行動を、対象月ごとの個別目標へ同期する。
// 安全ルール:
// - 手動編集済み(manuallyEdited)・手動削除済み(syncDeleted)の個別目標は上書き・復活させない。
// - 重点行動が非表示(archived)になった/対象月から外れた場合、関連するWeekly ToDoがある・
//   完了済み・手動編集済みのいずれかに該当する個別目標は削除せず「連携解除」(keyActionId=null)に留める。
//   該当しない(未着手・自動生成のまま・関連履歴なし)個別目標のみ論理削除(syncDeleted=true)する。
export async function syncIndividualGoalsForPhase(roadmapItemId: string): Promise<void> {
  const phase = await prisma.roadmapItem.findUnique({ where: { id: roadmapItemId } });
  if (!phase) return;

  const targetMonths = computeTargetMonths(phase.startDate, phase.dueDate);
  const keyActions = await prisma.keyAction.findMany({
    where: { roadmapItemId, archived: false },
    orderBy: { sortOrder: "asc" },
  });

  const expectedPairs = new Set<string>();
  for (const ka of keyActions) {
    for (const month of targetMonths) {
      expectedPairs.add(`${ka.id}:${month.getTime()}`);
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const ka of keyActions) {
      for (const month of targetMonths) {
        const existing = await tx.individualGoal.findUnique({
          where: { keyActionId_targetMonth: { keyActionId: ka.id, targetMonth: month } },
        });

        if (!existing) {
          await tx.individualGoal.create({
            data: {
              title: ka.title,
              content: ka.note,
              targetMonth: month,
              categoryId: phase.categoryId,
              roadmapItemId: phase.id,
              keyActionId: ka.id,
              status: "NOT_STARTED",
              progressPercent: 0,
            },
          });
          continue;
        }

        if (existing.syncDeleted || existing.manuallyEdited) continue; // ユーザーの意思を優先し触れない

        if (existing.title !== ka.title || existing.content !== ka.note || existing.roadmapItemId !== phase.id) {
          await tx.individualGoal.update({
            where: { id: existing.id },
            data: { title: ka.title, content: ka.note, roadmapItemId: phase.id, categoryId: phase.categoryId },
          });
        }
      }
    }

    // 対象から外れた(重点行動が削除/非対象月になった)自動生成の個別目標を後処理する。
    const existingGoals = await tx.individualGoal.findMany({
      where: { roadmapItemId: phase.id, keyActionId: { not: null }, syncDeleted: false },
      include: { weeklyTodoItems: { select: { id: true } } },
    });

    for (const goal of existingGoals) {
      const pairKey = `${goal.keyActionId}:${goal.targetMonth.getTime()}`;
      if (expectedPairs.has(pairKey)) continue;

      const hasHistory = goal.manuallyEdited || goal.status === "DONE" || goal.weeklyTodoItems.length > 0;
      if (hasHistory) {
        // 安全に削除できないため連携だけ解除し、個別目標自体は残す。
        await tx.individualGoal.update({ where: { id: goal.id }, data: { keyActionId: null } });
      } else {
        await tx.individualGoal.update({ where: { id: goal.id }, data: { syncDeleted: true } });
      }
    }
  });
}

// ロードマップの計画ブロック(RoadmapItem)自体を削除する直前に呼ぶ。
// そのブロックに紐づく個別目標(重点行動経由・直接紐づけの両方を含む)を、
// syncIndividualGoalsForPhaseの「対象外になった場合」と同じ安全ルールで後処理する:
// - 手動編集済み・完了済み・Weekly ToDoの紐づけがある(=履歴がある)個別目標は削除せず残す
//   (ブロック削除に伴うカスケードでroadmapItemId/keyActionIdはnullになるが、個別目標自体は消えない)。
// - 履歴の無い個別目標は論理削除(syncDeleted=true)し、個別目標の一覧からも消す。
// 呼び出し側(DELETE /api/roadmap/[id])が、この処理の直後にRoadmapItemを削除する想定。
export async function reconcileIndividualGoalsForDeletedRoadmapItem(roadmapItemId: string): Promise<void> {
  const goals = await prisma.individualGoal.findMany({
    where: { roadmapItemId, syncDeleted: false },
    include: { weeklyTodoItems: { select: { id: true } } },
  });

  const toSoftDelete = goals
    .filter((g) => !(g.manuallyEdited || g.status === "DONE" || g.weeklyTodoItems.length > 0))
    .map((g) => g.id);

  if (toSoftDelete.length === 0) return;

  await prisma.individualGoal.updateMany({
    where: { id: { in: toSoftDelete } },
    data: { syncDeleted: true },
  });
}
