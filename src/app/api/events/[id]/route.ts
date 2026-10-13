import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { eventUpdateSchema } from "@/lib/validation";
import { requireAuth, requireSameOrigin } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireAuth(req);
  if (authError) return authError;
  const csrfError = requireSameOrigin(req);
  if (csrfError) return csrfError;

  const { id } = await params;
  const body = await req.json();
  const parsed = eventUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.event.update({ where: { id }, data: parsed.data });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireAuth(req);
  if (authError) return authError;
  const csrfError = requireSameOrigin(req);
  if (csrfError) return csrfError;

  const { id } = await params;
  await prisma.event.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
