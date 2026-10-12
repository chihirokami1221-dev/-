import { prisma } from "@/lib/prisma";
import { AXIS_DEFINITIONS, AxisKey } from "./axes";
import { skillsOverlap, findUnmatchedMarketSkills } from "./skillMatch";

export type AxisStatus = "scored" | "insufficient_evidence" | "not_evaluated";

export interface AxisEvidenceItem {
  achievementId: string;
  title: string;
  date: Date;
  isReproducible: boolean;
  isMonetized: boolean;
}

export interface AxisScoreResult {
  key: AxisKey;
  label: string;
  status: AxisStatus;
  score: number; // 0-100。status !== "scored" の場合は常に0(根拠が無い状態で加点しないため)。
  baseCount: number; // この軸にタグ付けされた実績の件数(根拠が不十分でもタグ付けだけで増える)
  validCount: number; // 実際にスコアへ加点された(根拠が十分な)件数
  evidence: AxisEvidenceItem[];
  missingEvidence: string[];
}

export interface MarketValueEvalData {
  normalizedScore: number; // 0-100。未評価/根拠不足の軸は0として平均に含める。
  axisScores: Record<AxisKey, AxisScoreResult>;
  totalAchievementCount: number;
  totalReproducibleCount: number;
  totalMonetizedCount: number;
  totalThirdPartyCount: number;
  marketDataCount: number;
  gapSkills: string[]; // 市場データで求められているが、どの実績のスキルにも一致しないもの
}

type AchievementWithLinks = Awaited<ReturnType<typeof loadAchievements>>[number];

async function loadAchievements() {
  return prisma.achievement.findMany({ include: { axisLinks: true } });
}

function linkedTo(achievements: AchievementWithLinks[], axisKey: AxisKey) {
  return achievements.filter((a) => a.axisLinks.some((l) => l.axisKey === axisKey));
}

function toEvidence(a: AchievementWithLinks): AxisEvidenceItem {
  return {
    achievementId: a.id,
    title: a.title,
    date: a.date,
    isReproducible: a.isReproducible,
    isMonetized: a.isMonetized,
  };
}

function evalSpecialistSkill(achievements: AchievementWithLinks[]): AxisScoreResult {
  const linked = linkedTo(achievements, "specialist_skill");
  const reproducible = linked.filter((a) => a.isReproducible && a.reproducibilityNote.trim() !== "");

  if (linked.length === 0) {
    return {
      key: "specialist_skill",
      label: "専門スキル",
      status: "not_evaluated",
      score: 0,
      baseCount: 0,
      validCount: 0,
      evidence: [],
      missingEvidence: ["この軸に紐づく実績がまだ登録されていません。"],
    };
  }

  const score = Math.min(100, linked.length * 15 + reproducible.length * 10);
  const missing: string[] = [];
  if (linked.length < 3) missing.push("実績データが少なく、根拠としてはまだ不足しています。");
  if (reproducible.length === 0) missing.push("専門スキルを別の場面でも再現できた事例がまだありません。");

  return {
    key: "specialist_skill",
    label: "専門スキル",
    status: "scored",
    score,
    baseCount: linked.length,
    validCount: linked.length,
    evidence: linked.map(toEvidence),
    missingEvidence: missing,
  };
}

function evalAchievementResult(achievements: AchievementWithLinks[]): AxisScoreResult {
  const linked = linkedTo(achievements, "achievement_result");
  const quantified = linked.filter((a) => (a.metricValue ?? "").trim() !== "");
  const monetized = linked.filter((a) => a.isMonetized);

  if (linked.length === 0) {
    return {
      key: "achievement_result",
      label: "実績・成果",
      status: "not_evaluated",
      score: 0,
      baseCount: 0,
      validCount: 0,
      evidence: [],
      missingEvidence: ["この軸に紐づく実績がまだ登録されていません。"],
    };
  }

  const score = Math.min(100, linked.length * 10 + quantified.length * 15 + monetized.length * 10);
  const missing: string[] = [];
  if (quantified.length === 0) missing.push("数値で示せる成果がまだ登録されていません。");

  return {
    key: "achievement_result",
    label: "実績・成果",
    status: "scored",
    score,
    baseCount: linked.length,
    validCount: linked.length,
    evidence: linked.map(toEvidence),
    missingEvidence: missing,
  };
}

function evalReproducibility(achievements: AchievementWithLinks[]): AxisScoreResult {
  const linked = linkedTo(achievements, "reproducibility");
  const valid = linked.filter((a) => a.isReproducible && a.reproducibilityNote.trim() !== "");

  if (linked.length === 0) {
    return {
      key: "reproducibility",
      label: "再現性",
      status: "not_evaluated",
      score: 0,
      baseCount: 0,
      validCount: 0,
      evidence: [],
      missingEvidence: ["この軸に紐づく実績がまだ登録されていません。"],
    };
  }

  if (valid.length === 0) {
    return {
      key: "reproducibility",
      label: "再現性",
      status: "insufficient_evidence",
      score: 0,
      baseCount: linked.length,
      validCount: 0,
      evidence: linked.map(toEvidence),
      missingEvidence: ["タグ付けはありますが、再現できた根拠(具体的な説明)が未記入です。"],
    };
  }

  const score = Math.min(100, valid.length * 25);
  const missing: string[] = [];
  if (valid.length < linked.length) missing.push("一部の実績は再現できた根拠が未記入です。");

  return {
    key: "reproducibility",
    label: "再現性",
    status: "scored",
    score,
    baseCount: linked.length,
    validCount: valid.length,
    evidence: valid.map(toEvidence),
    missingEvidence: missing,
  };
}

function evalThirdPartyEvaluation(achievements: AchievementWithLinks[]): AxisScoreResult {
  const linked = linkedTo(achievements, "third_party_evaluation");
  const valid = linked.filter((a) => a.thirdPartyFeedback.trim() !== "");

  if (linked.length === 0) {
    return {
      key: "third_party_evaluation",
      label: "第三者評価",
      status: "not_evaluated",
      score: 0,
      baseCount: 0,
      validCount: 0,
      evidence: [],
      missingEvidence: ["この軸に紐づく実績がまだ登録されていません。"],
    };
  }

  if (valid.length === 0) {
    return {
      key: "third_party_evaluation",
      label: "第三者評価",
      status: "insufficient_evidence",
      score: 0,
      baseCount: linked.length,
      validCount: 0,
      evidence: linked.map(toEvidence),
      missingEvidence: ["タグ付けはありますが、第三者評価のコメントが未記入です。"],
    };
  }

  const score = Math.min(100, valid.length * 30);

  return {
    key: "third_party_evaluation",
    label: "第三者評価",
    status: "scored",
    score,
    baseCount: linked.length,
    validCount: valid.length,
    evidence: valid.map(toEvidence),
    missingEvidence: valid.length < linked.length ? ["一部の実績は第三者評価のコメントが未記入です。"] : [],
  };
}

async function evalMarketDemand(achievements: AchievementWithLinks[]): Promise<{
  result: AxisScoreResult;
  gapSkills: string[];
  marketDataCount: number;
}> {
  const marketEntries = await prisma.marketDataEntry.findMany();
  const linked = linkedTo(achievements, "market_demand");

  if (marketEntries.length === 0) {
    return {
      result: {
        key: "market_demand",
        label: "市場需要",
        status: "not_evaluated",
        score: 0,
        baseCount: linked.length,
        validCount: 0,
        evidence: linked.map(toEvidence),
        missingEvidence: ["市場データ(求人情報)がまだ登録されていません。"],
      },
      gapSkills: [],
      marketDataCount: 0,
    };
  }

  const marketSkillGroups = marketEntries.map((m) => `${m.requiredSkills},${m.preferredSkills}`);
  const matched = linked.filter((a) =>
    marketSkillGroups.some((group) => skillsOverlap(a.skillsUsed, group)),
  );

  const gapSkills = findUnmatchedMarketSkills(
    marketSkillGroups,
    achievements.map((a) => a.skillsUsed),
  );

  if (linked.length === 0) {
    return {
      result: {
        key: "market_demand",
        label: "市場需要",
        status: "insufficient_evidence",
        score: 0,
        baseCount: 0,
        validCount: 0,
        evidence: [],
        missingEvidence: ["市場データはありますが、対応する実績がまだタグ付けされていません。"],
      },
      gapSkills,
      marketDataCount: marketEntries.length,
    };
  }

  const score = Math.min(100, matched.length * 20 + (linked.length - matched.length) * 5);
  const missing: string[] = [];
  if (matched.length === 0) missing.push("市場データが求めるスキルと一致する実績がまだありません。");
  if (gapSkills.length > 0) missing.push(`市場で求められているが実績が無いスキル: ${gapSkills.slice(0, 5).join("、")}`);

  return {
    result: {
      key: "market_demand",
      label: "市場需要",
      status: "scored",
      score,
      baseCount: linked.length,
      validCount: matched.length,
      evidence: linked.map(toEvidence),
      missingEvidence: missing,
    },
    gapSkills,
    marketDataCount: marketEntries.length,
  };
}

export async function computeMarketValue(): Promise<MarketValueEvalData> {
  const achievements = await loadAchievements();

  const axisScores = {} as Record<AxisKey, AxisScoreResult>;
  axisScores.specialist_skill = evalSpecialistSkill(achievements);
  axisScores.achievement_result = evalAchievementResult(achievements);
  axisScores.reproducibility = evalReproducibility(achievements);
  axisScores.third_party_evaluation = evalThirdPartyEvaluation(achievements);

  const marketDemand = await evalMarketDemand(achievements);
  axisScores.market_demand = marketDemand.result;

  const totalRaw = AXIS_DEFINITIONS.reduce((sum, def) => sum + axisScores[def.key].score, 0);
  const normalizedScore = totalRaw / AXIS_DEFINITIONS.length;

  return {
    normalizedScore,
    axisScores,
    totalAchievementCount: achievements.length,
    totalReproducibleCount: achievements.filter((a) => a.isReproducible && a.reproducibilityNote.trim() !== "").length,
    totalMonetizedCount: achievements.filter((a) => a.isMonetized).length,
    totalThirdPartyCount: achievements.filter((a) => a.thirdPartyFeedback.trim() !== "").length,
    marketDataCount: marketDemand.marketDataCount,
    gapSkills: marketDemand.gapSkills,
  };
}
