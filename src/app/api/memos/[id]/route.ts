import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { memoUpdateSchema } from "@/lib/validation";
import { requireAuth, requireSameOrigin } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireAuth(req);
  if (authError) return authError;

  const { id } = await params;
  const memo = await prisma.memo.findUnique({ where: { id } });
  if (!memo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(memo);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireAuth(req);
  if (authError) return authError;
  const csrfError = requireSameOrigin(req);
  if (csrfError) return csrfError;

  const { id } = await params;
  const body = await req.json();
  const parsed = memoUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.memo.update({ where: { id }, data: parsed.data });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireAuth(req);
  if (authError) return authError;
  const csrfError = requireSameOrigin(req);
  if (csrfError) return csrfError;

  const { id } = await params;
  await prisma.memo.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
