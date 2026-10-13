import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { keyActionSchema } from "@/lib/validation";
import { syncIndividualGoalsForPhase } from "@/lib/keyActionSync";
import { requireAuth, requireSameOrigin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  const roadmapItemId = req.nextUrl.searchParams.get("roadmapItemId") ?? undefined;
  const actions = await prisma.keyAction.findMany({
    where: { roadmapItemId: roadmapItemId || undefined, archived: false },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(actions);
}

export async function POST(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;
  const csrfError = requireSameOrigin(req);
  if (csrfError) return csrfError;

  const body = await req.json();
  const parsed = keyActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const maxOrder = await prisma.keyAction.aggregate({
    where: { roadmapItemId: parsed.data.roadmapItemId },
    _max: { sortOrder: true },
  });

  const action = await prisma.keyAction.create({
    data: { ...parsed.data, sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 },
  });

  await syncIndividualGoalsForPhase(parsed.data.roadmapItemId);

  return NextResponse.json(action, { status: 201 });
}
