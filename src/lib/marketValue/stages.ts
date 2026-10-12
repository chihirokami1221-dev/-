import { AXIS_DEFINITIONS } from "./axes";
import { MarketValueEvalData } from "./score";

export interface StageCondition {
  label: string;
  check: (data: MarketValueEvalData) => boolean;
}

export interface StageDefinition {
  level: number;
  title: string;
  minScore: number;
  conditions: StageCondition[];
}

export const STAGE_DEFINITIONS: StageDefinition[] = [
  {
    level: 1,
    title: "学習者",
    minScore: 0,
    conditions: [],
  },
  {
    level: 2,
    title: "スキル保有者",
    minScore: 10,
    conditions: [
      {
        label: "実績登録5件以上",
        check: (d) => d.totalAchievementCount >= 5,
      },
    ],
  },
  {
    level: 3,
    title: "実務活用者",
    minScore: 20,
    conditions: [
      {
        label: "根拠のある再現性実績3件以上",
        check: (d) => d.totalReproducibleCount >= 3,
      },
    ],
  },
  {
    level: 4,
    title: "成果創出者",
    minScore: 35,
    conditions: [
      {
        label: "専門スキル軸・実績成果軸がともに40以上",
        check: (d) =>
          d.axisScores.specialist_skill.score >= 40 && d.axisScores.achievement_result.score >= 40,
      },
    ],
  },
  {
    level: 5,
    title: "再現可能な実績保有者",
    minScore: 50,
    conditions: [
      {
        label: "実績・成果軸50以上",
        check: (d) => d.axisScores.achievement_result.score >= 50,
      },
      {
        label: "再現性軸が評価済み(根拠あり)",
        check: (d) => d.axisScores.reproducibility.status === "scored",
      },
    ],
  },
  {
    level: 6,
    title: "他者に価値提供できる人",
    minScore: 65,
    conditions: [
      {
        label: "第三者評価のある実績2件以上",
        check: (d) => d.totalThirdPartyCount >= 2,
      },
    ],
  },
  {
    level: 7,
    title: "収益化できる人",
    minScore: 75,
    conditions: [
      {
        label: "収益化につながった実績2件以上",
        check: (d) => d.totalMonetizedCount >= 2,
      },
      {
        label: "市場需要軸が評価済み(市場データと一致する実績あり)",
        check: (d) => d.axisScores.market_demand.status === "scored",
      },
    ],
  },
  {
    level: 8,
    title: "市場から選ばれる人",
    minScore: 85,
    conditions: [
      {
        label: "市場需要軸70以上",
        check: (d) => d.axisScores.market_demand.score >= 70,
      },
      {
        label: "5軸中4軸以上が50以上",
        check: (d) => AXIS_DEFINITIONS.filter((def) => d.axisScores[def.key].score >= 50).length >= 4,
      },
    ],
  },
];

export interface StageEvalResult {
  currentLevel: number;
  currentTitle: string;
  nextStage: StageDefinition | null;
  nextStageConditionStatus: { label: string; achieved: boolean }[];
}

export function evaluateStage(data: MarketValueEvalData): StageEvalResult {
  let currentLevel = 1;

  for (const stage of STAGE_DEFINITIONS) {
    const scoreOk = data.normalizedScore >= stage.minScore;
    const conditionsOk = stage.conditions.every((c) => c.check(data));
    if (scoreOk && conditionsOk) {
      currentLevel = stage.level;
    } else {
      break;
    }
  }

  const current = STAGE_DEFINITIONS.find((s) => s.level === currentLevel)!;
  const nextStage = STAGE_DEFINITIONS.find((s) => s.level === currentLevel + 1) ?? null;

  const nextStageConditionStatus = nextStage
    ? [
        { label: `総合スコア${nextStage.minScore}以上`, achieved: data.normalizedScore >= nextStage.minScore },
        ...nextStage.conditions.map((c) => ({ label: c.label, achieved: c.check(data) })),
      ]
    : [];

  return {
    currentLevel: current.level,
    currentTitle: current.title,
    nextStage,
    nextStageConditionStatus,
  };
}
