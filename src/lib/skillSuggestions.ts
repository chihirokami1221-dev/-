import { prisma } from "@/lib/prisma";

// 表示用なので大文字小文字は元の表記を保持し、同じ単語の重複だけ除く(小文字キーで判定)。
// 照合用のsplitSkills(skillMatch.ts)は小文字化するため、ここでは別定義にしている。
function splitSkillsPreservingCase(raw: string): string[] {
  return raw
    .split(/[,、,/・\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// 既存の実績・市場データで使われているスキル語を集め、重複を除いた候補リストを返す。
// 同じ表記を使い回してもらうことで、入力の手間と市場需要軸の照合精度の両方を改善する。
export async function getSkillSuggestions(): Promise<string[]> {
  const [achievements, marketEntries] = await Promise.all([
    prisma.achievement.findMany({ select: { skillsUsed: true } }),
    prisma.marketDataEntry.findMany({ select: { requiredSkills: true, preferredSkills: true } }),
  ]);

  const raw = [
    ...achievements.map((a) => a.skillsUsed),
    ...marketEntries.flatMap((m) => [m.requiredSkills, m.preferredSkills]),
  ];

  const seen = new Map<string, string>(); // 小文字キー → 元の表記(最初に出てきたものを採用)
  const counts = new Map<string, number>();
  for (const text of raw) {
    for (const skill of splitSkillsPreservingCase(text)) {
      const key = skill.toLowerCase();
      if (!seen.has(key)) seen.set(key, skill);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  // よく使われているスキルほど上位に出す(同数なら五十音/アルファベット順)。
  return [...seen.entries()]
    .sort((a, b) => (counts.get(b[0])! - counts.get(a[0])!) || a[1].localeCompare(b[1], "ja"))
    .map(([, label]) => label);
}
