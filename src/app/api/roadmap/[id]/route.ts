import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { roadmapItemUpdateSchema } from "@/lib/validation";
import { syncProgressWithStatus } from "@/lib/roadmapProgress";
import { syncIndividualGoalsForPhase } from "@/lib/keyActionSync";
import { requireAuth, requireSameOrigin } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireAuth(req);
  if (authError) return authError;

  const { id } = await params;
  const item = await prisma.roadmapItem.findUnique({ where: { id }, include: { category: true } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(item);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireAuth(req);
  if (authError) return authError;
  const csrfError = requireSameOrigin(req);
  if (csrfError) return csrfError;

  const { id } = await params;
  const body = await req.json();
  const parsed = roadmapItemUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.roadmapItem.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data = parsed.data;
  const nextStatus = data.status ?? existing.status;
  const basePercent = data.progressPercent ?? existing.progressPercent;
  const progressPercent = syncProgressWithStatus(nextStatus, basePercent);

  const updated = await prisma.roadmapItem.update({
    where: { id },
    data: { ...data, progressPercent },
  });

  if (data.startDate !== undefined || data.dueDate !== undefined) {
    await syncIndividualGoalsForPhase(id);
  }

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireAuth(req);
  if (authError) return authError;
  const csrfError = requireSameOrigin(req);
  if (csrfError) return csrfError;

  const { id } = await params;
  await prisma.roadmapItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
