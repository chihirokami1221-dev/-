import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { keyActionUpdateSchema } from "@/lib/validation";
import { syncIndividualGoalsForPhase } from "@/lib/keyActionSync";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = keyActionUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.keyAction.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.keyAction.update({ where: { id }, data: parsed.data });
  await syncIndividualGoalsForPhase(existing.roadmapItemId);

  return NextResponse.json(updated);
}

// 重点行動は物理削除せず、論理削除(archived=true)にする。
// 派生した個別目標・実績・Weekly ToDoの履歴を保護するため(syncIndividualGoalsForPhaseが安全に後処理する)。
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.keyAction.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.keyAction.update({ where: { id }, data: { archived: true } });
  await syncIndividualGoalsForPhase(existing.roadmapItemId);

  return NextResponse.json({ ok: true });
}
