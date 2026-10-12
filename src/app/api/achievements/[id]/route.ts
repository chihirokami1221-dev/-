import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { achievementUpdateSchema } from "@/lib/validation";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const achievement = await prisma.achievement.findUnique({
    where: { id },
    include: { category: true, axisLinks: true },
  });
  if (!achievement) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(achievement);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = achievementUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { axisKeys, ...data } = parsed.data;

  const updated = await prisma.$transaction(async (tx) => {
    if (axisKeys) {
      await tx.achievementAxisLink.deleteMany({ where: { achievementId: id } });
      await tx.achievementAxisLink.createMany({
        data: axisKeys.map((axisKey) => ({ achievementId: id, axisKey })),
      });
    }
    return tx.achievement.update({
      where: { id },
      data,
      include: { axisLinks: true },
    });
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.achievement.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
