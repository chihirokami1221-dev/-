import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { diaryEntrySchema } from "@/lib/validation";

export async function GET(req: NextRequest) {
  const categoryId = req.nextUrl.searchParams.get("categoryId") ?? undefined;
  const keyword = req.nextUrl.searchParams.get("keyword") ?? undefined;
  const month = req.nextUrl.searchParams.get("month") ?? undefined; // YYYY-MM

  let dateFilter: { gte: Date; lte: Date } | undefined;
  if (month) {
    const [y, m] = month.split("-").map(Number);
    dateFilter = {
      gte: new Date(y, m - 1, 1, 0, 0, 0, 0),
      lte: new Date(y, m, 0, 23, 59, 59, 999),
    };
  }

  const entries = await prisma.diaryEntry.findMany({
    where: {
      categoryId: categoryId || undefined,
      date: dateFilter,
      content: keyword ? { contains: keyword } : undefined,
    },
    include: { category: true },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = diaryEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const entry = await prisma.diaryEntry.create({ data: parsed.data });
  return NextResponse.json(entry, { status: 201 });
}
