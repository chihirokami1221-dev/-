import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { weeklyTodoSchema } from "@/lib/validation";
import { getStartOfWeek } from "@/lib/weekUtils";

export async function GET(req: NextRequest) {
  const weekParam = req.nextUrl.searchParams.get("weekStart");
  const weekStart = weekParam ? new Date(weekParam) : getStartOfWeek(new Date());

  const tasks = await prisma.weeklyTodoItem.findMany({
    where: { weekStart },
    orderBy: [{ dayOfWeek: "asc" }, { isDone: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = weeklyTodoSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const task = await prisma.weeklyTodoItem.create({ data: parsed.data });
  return NextResponse.json(task, { status: 201 });
}
