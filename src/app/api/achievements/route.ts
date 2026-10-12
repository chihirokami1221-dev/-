import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { achievementSchema } from "@/lib/validation";

export async function GET(req: NextRequest) {
  const categoryId = req.nextUrl.searchParams.get("categoryId") ?? undefined;
  const axisKey = req.nextUrl.searchParams.get("axisKey") ?? undefined;

  const achievements = await prisma.achievement.findMany({
    where: {
      categoryId: categoryId || undefined,
      axisLinks: axisKey ? { some: { axisKey } } : undefined,
    },
    include: { category: true, axisLinks: true },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(achievements);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = achievementSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { axisKeys, ...data } = parsed.data;

  // 同じ日付・同じタイトル・同じカテゴリーの実績が既にある場合は重複登録として拒否する
  // (二重送信や、同じ日記から複数回抽出した場合の重複防止)。
  const duplicate = await prisma.achievement.findFirst({
    where: { title: data.title, date: data.date, categoryId: data.categoryId },
  });
  if (duplicate) {
    return NextResponse.json(
      { error: `同じ日付・タイトルの実績が既に登録されています(「${duplicate.title}」)。` },
      { status: 409 },
    );
  }

  const achievement = await prisma.achievement.create({
    data: {
      ...data,
      axisLinks: { create: axisKeys.map((axisKey) => ({ axisKey })) },
    },
    include: { axisLinks: true },
  });

  return NextResponse.json(achievement, { status: 201 });
}
