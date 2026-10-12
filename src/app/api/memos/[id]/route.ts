import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { memoUpdateSchema } from "@/lib/validation";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const memo = await prisma.memo.findUnique({ where: { id } });
  if (!memo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(memo);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = memoUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.memo.update({ where: { id }, data: parsed.data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.memo.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
