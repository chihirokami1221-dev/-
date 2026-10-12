import { AXIS_DEFINITIONS, AxisKey } from "./axes";
import { AxisStatus, MarketValueEvalData } from "./score";

export interface AxisSnapshotEntry {
  score: number;
  status: AxisStatus;
}

export type AxisSnapshotMap = Record<string, AxisSnapshotEntry>;

export function buildAxisSnapshotMap(data: MarketValueEvalData): AxisSnapshotMap {
  const map: AxisSnapshotMap = {};
  for (const def of AXIS_DEFINITIONS) {
    const r = data.axisScores[def.key];
    map[def.key] = { score: r.score, status: r.status };
  }
  return map;
}

// 直前のスナップショットとの差分だけから理由を組み立てる(スコアや根拠を創作しない)。
export function buildReasonNote(
  previous: AxisSnapshotMap | null,
  current: AxisSnapshotMap,
  previousAchievementCount: number,
  currentAchievementCount: number,
): string {
  if (!previous) return "初回の記録です。";

  const parts: string[] = [];
  const achievementDiff = currentAchievementCount - previousAchievementCount;
  if (achievementDiff !== 0) {
    parts.push(`実績が${achievementDiff > 0 ? `${achievementDiff}件増加` : `${-achievementDiff}件減少`}`);
  }

  for (const def of AXIS_DEFINITIONS as { key: AxisKey; label: string }[]) {
    const prev = previous[def.key];
    const curr = current[def.key];
    if (!prev || !curr) continue;
    const diff = Math.round((curr.score - prev.score) * 10) / 10;
    if (diff === 0 && prev.status === curr.status) continue;

    if (prev.status !== curr.status) {
      parts.push(`${def.label}軸が「${statusLabel(prev.status)}」→「${statusLabel(curr.status)}」`);
    } else if (diff !== 0) {
      parts.push(`${def.label}軸が${diff > 0 ? `+${diff}` : diff}`);
    }
  }

  if (parts.length === 0) return "根拠に変化がないため、評価は前回から変動していません。";
  return parts.join("、") + "。";
}

function statusLabel(status: AxisStatus): string {
  if (status === "scored") return "評価済み";
  if (status === "insufficient_evidence") return "根拠不足";
  return "未評価";
}
