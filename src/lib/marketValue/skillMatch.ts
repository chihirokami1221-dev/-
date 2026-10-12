// スキルの文字列(カンマ・読点・スラッシュ・中点区切り)を単純な単語レベルで比較するためのユーティリティ。
// 自然言語的な意味の一致までは判定できない単純な部分一致なので、結果は参考情報として扱う。
export function splitSkills(raw: string): string[] {
  return raw
    .split(/[,、,/・\n]/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

export function skillsOverlap(a: string, b: string): boolean {
  const skillsA = splitSkills(a);
  const skillsB = splitSkills(b);
  if (skillsA.length === 0 || skillsB.length === 0) return false;
  return skillsA.some((sa) => skillsB.some((sb) => sa.includes(sb) || sb.includes(sa)));
}

// 市場データ側に登場するが、どの実績のスキルにも一致しなかったスキルの一覧(市場要求とのギャップ)。
export function findUnmatchedMarketSkills(
  marketSkillGroups: string[],
  achievementSkillGroups: string[],
): string[] {
  const achievementSkills = achievementSkillGroups.flatMap(splitSkills);
  const unmatched = new Set<string>();

  for (const group of marketSkillGroups) {
    for (const skill of splitSkills(group)) {
      const matched = achievementSkills.some((as) => as.includes(skill) || skill.includes(as));
      if (!matched) unmatched.add(skill);
    }
  }

  return Array.from(unmatched);
}
