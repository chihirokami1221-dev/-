import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { eventSchema } from "@/lib/validation";

export async function GET(req: NextRequest) {
  const categoryId = req.nextUrl.searchParams.get("categoryId") ?? undefined;
  const events = await prisma.event.findMany({
    where: { categoryId: categoryId || undefined },
    orderBy: { date: "asc" },
  });
  return NextResponse.json(events);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const event = await prisma.event.create({ data: parsed.data });
  return NextResponse.json(event, { status: 201 });
}
