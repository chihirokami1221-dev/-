import { prisma } from "@/lib/prisma";
import { computeWeeklyDiaryProgress } from "@/lib/weeklyDiaryProgress";
import { computeMarketValue } from "@/lib/marketValue/score";
import { evaluateStage } from "@/lib/marketValue/stages";
import { formatJP } from "@/lib/dateUtils";

// AIチャットに渡すシステムプロンプト。ユーザーの実データ(日記・ロードマップ・実績・市場価値)を
// 要約して埋め込み、推測ではなく実際の記録を踏まえた相談相手として振る舞わせる。
export async function buildChatSystemPrompt(): Promise<string> {
  const categories = await prisma.category.findMany({ orderBy: { sortOrder: "asc" } });
  const weeklyProgress = await Promise.all(categories.map((c) => computeWeeklyDiaryProgress(c.id)));

  const recentDiary = await prisma.diaryEntry.findMany({
    orderBy: { date: "desc" },
    take: 5,
    include: { category: true },
  });

  const inProgressRoadmap = await prisma.roadmapItem.findMany({
    where: { status: "IN_PROGRESS" },
    include: { category: true },
    orderBy: { dueDate: "asc" },
    take: 5,
  });

  const achievementCounts = await prisma.achievement.groupBy({
    by: ["categoryId"],
    _count: { _all: true },
  });

  const marketValue = await computeMarketValue();
  const stage = evaluateStage(marketValue);

  const lines: string[] = [];
  lines.push("あなたは「成長OS」というユーザー専用の自己成長管理アプリに組み込まれたAI相談相手です。");
  lines.push("以下はユーザーの実際の記録です。これらの事実を踏まえて、日本語で具体的にアドバイスしてください。");
  lines.push("記録にないことを事実として断定しないでください。わからない場合は素直にわからないと言ってください。");
  lines.push("ローカルPCのCPUで動いているため生成速度が遅いです。回答は長くても5文程度に収め、前置きや言い換えを省いて要点から簡潔に答えてください。");
  lines.push("");

  lines.push("【今週の日記記入状況(月〜日、書いた日数/7日)】");
  categories.forEach((c, i) => {
    lines.push(`- ${c.label}: ${weeklyProgress[i].daysWritten}/7日`);
  });
  lines.push("");

  lines.push("【直近の日記(新しい順、最大5件・一部抜粋)】");
  if (recentDiary.length === 0) {
    lines.push("(まだ記録なし)");
  } else {
    recentDiary.forEach((e) => {
      const d = e.date.toISOString().slice(0, 10);
      const snippet = e.content.length > 120 ? e.content.slice(0, 120) + "…" : e.content;
      lines.push(`- [${d} / ${e.category.label}] ${snippet}`);
    });
  }
  lines.push("");

  lines.push("【進行中のロードマップ項目(最大5件)】");
  if (inProgressRoadmap.length === 0) {
    lines.push("(進行中の項目なし)");
  } else {
    inProgressRoadmap.forEach((r) => {
      const due = r.dueDate ? formatJP(r.dueDate) : "期限未設定";
      lines.push(`- [${r.category.label}] ${r.title}(期限: ${due}、進捗${r.progressPercent}%)`);
    });
  }
  lines.push("");

  lines.push("【実績データベース件数(カテゴリ別)】");
  categories.forEach((c) => {
    const count = achievementCounts.find((a) => a.categoryId === c.id)?._count._all ?? 0;
    lines.push(`- ${c.label}: ${count}件`);
  });
  lines.push("");

  lines.push(`【市場価値ステージ】現在 Lv${stage.currentLevel}「${stage.currentTitle}」(総合スコア${Math.round(marketValue.normalizedScore)}/100)`);

  return lines.join("\n");
}
