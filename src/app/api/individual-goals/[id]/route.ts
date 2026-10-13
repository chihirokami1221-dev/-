import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { individualGoalUpdateSchema } from "@/lib/validation";
import { syncProgressWithStatus } from "@/lib/roadmapProgress";
import { requireAuth, requireSameOrigin } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireAuth(req);
  if (authError) return authError;

  const { id } = await params;
  const goal = await prisma.individualGoal.findUnique({
    where: { id },
    include: { category: true, roadmapItem: { select: { id: true, title: true } }, keyAction: { select: { id: true, title: true } } },
  });
  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(goal);
}

// このAPI経由の更新は、すべてユーザーによる手動操作とみなしmanuallyEdited=trueにする
// (自動同期エンジンはこのAPIを経由せずPrismaを直接呼ぶため、ここを通る時点で手動編集として保護対象になる)。
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireAuth(req);
  if (authError) return authError;
  const csrfError = requireSameOrigin(req);
  if (csrfError) return csrfError;

  const { id } = await params;
  const body = await req.json();
  const parsed = individualGoalUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.individualGoal.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data = parsed.data;
  const nextStatus = data.status ?? existing.status;
  const basePercent = data.progressPercent ?? existing.progressPercent;
  const progressPercent = syncProgressWithStatus(nextStatus, basePercent);

  const updated = await prisma.individualGoal.update({
    where: { id },
    data: { ...data, progressPercent, manuallyEdited: true },
  });

  return NextResponse.json(updated);
}

// 物理削除せず論理削除(syncDeleted=true)する。同期処理が次回以降このIDを復活させないようにするため。
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireAuth(req);
  if (authError) return authError;
  const csrfError = requireSameOrigin(req);
  if (csrfError) return csrfError;

  const { id } = await params;
  const existing = await prisma.individualGoal.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.individualGoal.update({ where: { id }, data: { syncDeleted: true, manuallyEdited: true } });
  return NextResponse.json({ ok: true });
}
