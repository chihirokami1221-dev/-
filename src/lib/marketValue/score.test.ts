import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evalSpecialistSkill,
  evalAchievementResult,
  evalReproducibility,
  evalThirdPartyEvaluation,
} from "./score";
import { skillsOverlap } from "./skillMatch";

// DBに一切接続せず、各軸の計算ロジック(純粋関数)のみを固定データで検証する。
// score.tsの仕様(評価式)をそのまま使い、独立して手計算した期待値と突き合わせる。

function achievement(overrides: Record<string, unknown>) {
  return {
    id: "a1",
    title: "テスト実績",
    date: new Date("2026-10-01"),
    metricValue: null as string | null,
    revenueAmount: null as number | null,
    thirdPartyFeedback: "",
    skillsUsed: "",
    axisLinks: [] as { axisKey: string }[],
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

test("evalSpecialistSkill: 紐づく実績が0件ならnot_evaluated", () => {
  const result = evalSpecialistSkill([]);
  assert.equal(result.status, "not_evaluated");
  assert.equal(result.score, 0);
});

test("evalSpecialistSkill: 専門スキル3件(うち再現性2件)でスコアが仕様通り算出される", () => {
  const list = [
    achievement({ id: "a1", axisLinks: [{ axisKey: "specialist_skill" }, { axisKey: "reproducibility" }] }),
    achievement({ id: "a2", axisLinks: [{ axisKey: "specialist_skill" }, { axisKey: "reproducibility" }] }),
    achievement({ id: "a3", axisLinks: [{ axisKey: "specialist_skill" }] }),
  ];
  const result = evalSpecialistSkill(list);
  // min(100, linked(3)*15 + reproducible(2)*10) = min(100, 45+20) = 65
  assert.equal(result.status, "scored");
  assert.equal(result.score, 65);
  assert.equal(result.baseCount, 3);
});

test("evalAchievementResult: 定量成果・収益化の有無でスコアが変わる", () => {
  const list = [
    achievement({ axisLinks: [{ axisKey: "achievement_result" }], metricValue: "20%改善", revenueAmount: 5000 }),
  ];
  const result = evalAchievementResult(list);
  // min(100, linked(1)*10 + quantified(1)*15 + monetized(1)*10) = 35
  assert.equal(result.score, 35);
});

test("evalReproducibility: 紐づく件数×25(上限100)", () => {
  const list = [1, 2, 3, 4, 5].map((n) =>
    achievement({ id: `r${n}`, axisLinks: [{ axisKey: "reproducibility" }] }),
  );
  const result = evalReproducibility(list);
  // min(100, 5*25) = 100 で上限に達することを確認
  assert.equal(result.score, 100);
});

test("evalThirdPartyEvaluation: コメント未記入はinsufficient_evidenceで加点しない", () => {
  const list = [achievement({ axisLinks: [{ axisKey: "third_party_evaluation" }], thirdPartyFeedback: "" })];
  const result = evalThirdPartyEvaluation(list);
  assert.equal(result.status, "insufficient_evidence");
  assert.equal(result.score, 0);
});

test("evalThirdPartyEvaluation: コメントが記入されていればscoredで加点される", () => {
  const list = [
    achievement({ axisLinks: [{ axisKey: "third_party_evaluation" }], thirdPartyFeedback: "とても良かった" }),
  ];
  const result = evalThirdPartyEvaluation(list);
  assert.equal(result.status, "scored");
  assert.equal(result.score, 30); // min(100, 1*30)
});

test("skillsOverlap(市場需要軸が使う一致判定): 一部一致する文字列はtrue", () => {
  assert.equal(skillsOverlap("テストスキルA,テストスキルB", "テストスキルA,別スキル"), true);
});

test("skillsOverlap: 完全に一致しない文字列はfalse", () => {
  assert.equal(skillsOverlap("スキルX", "スキルY"), false);
});

test("skillsOverlap: 空文字同士はfalse(未評価として扱う)", () => {
  assert.equal(skillsOverlap("", ""), false);
});
