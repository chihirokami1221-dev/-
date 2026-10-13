import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { marketDataSchema } from "@/lib/validation";
import { requireAuth, requireSameOrigin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  const entries = await prisma.marketDataEntry.findMany({ orderBy: { fetchedAt: "desc" } });
  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;
  const csrfError = requireSameOrigin(req);
  if (csrfError) return csrfError;

  const body = await req.json();
  const parsed = marketDataSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const entry = await prisma.marketDataEntry.create({ data: parsed.data });
  return NextResponse.json(entry, { status: 201 });
}
