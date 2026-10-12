import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { memoSchema } from "@/lib/validation";

export async function GET() {
  const memos = await prisma.memo.findMany({ orderBy: { updatedAt: "desc" } });
  return NextResponse.json(memos);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = memoSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const memo = await prisma.memo.create({ data: parsed.data });
  return NextResponse.json(memo, { status: 201 });
}
