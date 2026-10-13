import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { individualGoalCreateSchema } from "@/lib/validation";
import { monthStartOfDate } from "@/lib/monthOptions";
import { requireAuth, requireSameOrigin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  const categoryId = req.nextUrl.searchParams.get("categoryId") ?? undefined;
  const month = req.nextUrl.searchParams.get("month") ?? undefined; // YYYY-MM-01 (targetMonthの厳密一致)

  const goals = await prisma.individualGoal.findMany({
    where: {
      categoryId: categoryId || undefined,
      targetMonth: month ? new Date(month) : undefined,
      syncDeleted: false,
    },
    include: { category: true, roadmapItem: { select: { id: true, title: true } }, keyAction: { select: { id: true, title: true } } },
    orderBy: [{ targetMonth: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(goals);
}

// ロードマップの重点行動からの自動生成とは別に、ユーザーが直接個別目標を登録するためのエンドポイント。
// roadmapItemId/keyActionIdをnullのまま作成し、manuallyEdited=trueにすることで自動同期の上書き対象から外す。
export async function POST(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;
  const csrfError = requireSameOrigin(req);
  if (csrfError) return csrfError;

  const body = await req.json();
  const parsed = individualGoalCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const goal = await prisma.individualGoal.create({
    data: {
      ...parsed.data,
      // 期限が未入力の場合は、対象月の内部キー(targetMonth)として今月を使う(一覧のグルーピング用で表示上の意味は持たない)。
      targetMonth: monthStartOfDate(parsed.data.dueDate ?? new Date()),
      manuallyEdited: true,
    },
    include: { category: true, roadmapItem: { select: { id: true, title: true } }, keyAction: { select: { id: true, title: true } } },
  });

  return NextResponse.json(goal, { status: 201 });
}
