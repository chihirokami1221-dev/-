import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeMarketValue } from "@/lib/marketValue/score";
import { evaluateStage } from "@/lib/marketValue/stages";
import { buildAxisSnapshotMap, buildReasonNote, AxisSnapshotMap } from "@/lib/marketValue/history";
import { requireAuth, requireSameOrigin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  const data = await computeMarketValue();
  const stageEval = evaluateStage(data);
  const latestSnapshot = await prisma.marketValueScoreSnapshot.findFirst({
    orderBy: { computedAt: "desc" },
  });

  return NextResponse.json({
    normalizedScore: data.normalizedScore,
    stageLevel: stageEval.currentLevel,
    stageTitle: stageEval.currentTitle,
    previousScore: latestSnapshot?.totalScore ?? null,
  });
}

// 「スコアを更新」操作時にスナップショットを保存する(閲覧のたびに自動保存はしない)。
export async function POST(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;
  const csrfError = requireSameOrigin(req);
  if (csrfError) return csrfError;

  const data = await computeMarketValue();
  const stageEval = evaluateStage(data);

  const previousSnapshot = await prisma.marketValueScoreSnapshot.findFirst({
    orderBy: { computedAt: "desc" },
  });

  const currentAxisMap = buildAxisSnapshotMap(data);
  let previousAxisMap: AxisSnapshotMap | null = null;
  if (previousSnapshot) {
    try {
      previousAxisMap = JSON.parse(previousSnapshot.axisScoresJson);
    } catch {
      previousAxisMap = null;
    }
  }

  const reasonNote = buildReasonNote(
    previousAxisMap,
    currentAxisMap,
    previousSnapshot?.achievementCountAtSnapshot ?? 0,
    data.totalAchievementCount,
  );

  const snapshot = await prisma.marketValueScoreSnapshot.create({
    data: {
      totalScore: data.normalizedScore,
      stageLevel: stageEval.currentLevel,
      axisScoresJson: JSON.stringify(currentAxisMap),
      reasonNote,
      achievementCountAtSnapshot: data.totalAchievementCount,
    },
  });

  return NextResponse.json(snapshot, { status: 201 });
}
