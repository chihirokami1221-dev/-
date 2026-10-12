import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { roadmapItemSchema } from "@/lib/validation";
import { syncProgressWithStatus } from "@/lib/roadmapProgress";

export async function GET(req: NextRequest) {
  const categoryId = req.nextUrl.searchParams.get("categoryId") ?? undefined;
  const status = req.nextUrl.searchParams.get("status") ?? undefined;

  const items = await prisma.roadmapItem.findMany({
    where: {
      categoryId: categoryId || undefined,
      status: (status as never) || undefined,
    },
    include: { category: true },
    orderBy: [{ priority: "asc" }, { dueDate: "asc" }],
  });

  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = roadmapItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const progressPercent = syncProgressWithStatus(data.status, data.progressPercent);

  const item = await prisma.roadmapItem.create({
    data: { ...data, progressPercent },
  });

  return NextResponse.json(item, { status: 201 });
}
