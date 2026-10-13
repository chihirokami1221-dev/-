import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { eventSchema } from "@/lib/validation";
import { requireAuth, requireSameOrigin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  const categoryId = req.nextUrl.searchParams.get("categoryId") ?? undefined;
  const events = await prisma.event.findMany({
    where: { categoryId: categoryId || undefined },
    orderBy: { date: "asc" },
  });
  return NextResponse.json(events);
}

export async function POST(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;
  const csrfError = requireSameOrigin(req);
  if (csrfError) return csrfError;

  const body = await req.json();
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const event = await prisma.event.create({ data: parsed.data });
  return NextResponse.json(event, { status: 201 });
}
