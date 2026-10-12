export type AxisKey =
  | "specialist_skill"
  | "achievement_result"
  | "reproducibility"
  | "third_party_evaluation"
  | "market_demand";

export interface AxisDefinition {
  key: AxisKey;
  label: string;
  description: string;
  scoringNote: string;
  nextActionGuide: string;
}

export const AXIS_DEFINITIONS: AxisDefinition[] = [
  {
    key: "specialist_skill",
    label: "専門スキル",
    description: "特定領域における専門的な知識・技術を、実務で活用できているか。",
    scoringNote: "この軸に紐づく実績の件数と、その中で再現性が確認できた件数から算出します。",
    nextActionGuide: "専門領域を実務で活用した事例を実績として登録し、この軸に紐づけましょう。",
  },
  {
    key: "achievement_result",
    label: "実績・成果",
    description: "行動によって生まれた具体的な結果。数値で示せる成果ほど強い根拠になる。",
    scoringNote: "この軸に紐づく実績の件数、定量的な数値を伴う件数、収益化につながった件数から算出します。",
    nextActionGuide: "数値で示せる成果(時間削減・売上向上など)を実績として登録しましょう。",
  },
  {
    key: "reproducibility",
    label: "再現性",
    description: "同じ成果を他の場面でも再現できるか。",
    scoringNote: "実績登録時に「再現性」をタグ付けした件数から算出します。",
    nextActionGuide: "別の場面でも再現できた実績を登録し、「再現性」の軸にタグ付けしましょう。",
  },
  {
    key: "third_party_evaluation",
    label: "第三者評価",
    description: "上司・顧客など自分以外からの評価。自己評価だけでは根拠にならない。",
    scoringNote: "第三者からの評価コメントが記入された実績の件数から算出します。コメントが未記入の場合は加点しません。",
    nextActionGuide: "上司・顧客など第三者から評価された実績があれば、その内容を実績に記入しましょう。",
  },
  {
    key: "market_demand",
    label: "市場需要",
    description: "求人・案件で求められるスキルや経験と、自分の実績がどれだけ重なっているか。",
    scoringNote: "登録した市場データ(求人情報)の必須・歓迎スキルと、全実績のスキルがどれだけ重なっているかから自動算出します(実績側でのタグ付けは不要)。市場データが未登録の場合は評価しません。",
    nextActionGuide: "市場データ(求人情報)を登録し、実績のスキルと重なっているかを確認しましょう。",
  },
];

// 実績登録フォームでタグ付け可能な軸(市場需要は全実績のスキルから自動算出するため対象外)。
export const ACHIEVEMENT_TAGGABLE_AXES = AXIS_DEFINITIONS.filter((a) => a.key !== "market_demand");

export function getAxisDefinition(key: AxisKey): AxisDefinition {
  const def = AXIS_DEFINITIONS.find((a) => a.key === key);
  if (!def) throw new Error(`Unknown axis key: ${key}`);
  return def;
}
