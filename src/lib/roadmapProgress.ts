import { RoadmapStatus } from "@prisma/client";

// statusがNOT_STARTED/DONEのときはprogressPercentを実態に同期させる。
// IN_PROGRESS/ON_HOLDはユーザーが入力したprogressPercentをそのまま使う。
export function syncProgressWithStatus(status: RoadmapStatus, progressPercent: number): number {
  if (status === "NOT_STARTED") return 0;
  if (status === "DONE") return 100;
  return progressPercent;
}

