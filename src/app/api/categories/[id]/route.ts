import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { longTermPlanUpdateSchema } from "@/lib/validation";

// 「長期指針」の更新のみを扱う。ここから日付を自動抽出してロードマップを生成する処理は行わない
// (計画ブロック・行動はロードマップ画面で個別に構造化入力するため、テキスト解析による二重管理はしない)。
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = longTermPlanUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const category = await prisma.category.update({ where: { id }, data: parsed.data });
  return NextResponse.json(category);
}
