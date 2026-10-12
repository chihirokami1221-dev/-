import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { weeklyTodoUpdateSchema } from "@/lib/validation";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = weeklyTodoUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.weeklyTodoItem.update({ where: { id }, data: parsed.data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.weeklyTodoItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
