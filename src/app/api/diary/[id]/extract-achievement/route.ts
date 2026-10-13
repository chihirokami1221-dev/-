import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { chatWithOllama, isAiDisabled } from "@/lib/ollama";
import { requireAuth, requireSameOrigin } from "@/lib/auth";

interface AchievementDraft {
  title: string;
  challenge: string;
  action: string;
  result: string;
  metricValue: string;
  skillsUsed: string;
  missingEvidenceHint: string[];
}

function parseDraft(raw: string): AchievementDraft | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;

  try {
    const obj = JSON.parse(raw.slice(start, end + 1));
    const hint = Array.isArray(obj.missingEvidenceHint)
      ? obj.missingEvidenceHint.map((s: unknown) => String(s)).filter((s: string) => s.trim() !== "")
      : [];
    return {
      title: String(obj.title ?? ""),
      challenge: String(obj.challenge ?? ""),
      action: String(obj.action ?? ""),
      result: String(obj.result ?? ""),
      metricValue: String(obj.metricValue ?? ""),
      skillsUsed: String(obj.skillsUsed ?? ""),
      missingEvidenceHint: hint,
    };
  } catch {
    return null;
  }
}

// 日記の内容から実績候補(未確定)を抽出するだけのエンドポイント。ここではDBに何も保存しない。
// ユーザーが確認・編集し、実績登録フォームで明示的に保存して初めて実績として確定する(無条件加点を防ぐ)。
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireAuth(req);
  if (authError) return authError;
  const csrfError = requireSameOrigin(req);
  if (csrfError) return csrfError;
  if (isAiDisabled()) {
    return NextResponse.json({ error: "AI機能はWeb版では利用できません。ローカル版でご利用ください。" }, { status: 503 });
  }

  const { id } = await params;
  const entry = await prisma.diaryEntry.findUnique({ where: { id }, include: { category: true } });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const prompt = [
    "以下はユーザーの日記です。この中から「実績として登録できそうな内容」があれば抽出してください。",
    "実績とは、実際に行った具体的な行動とその結果を指します。単なる感想・学習しただけの内容・予定は実績ではありません。",
    "該当する内容がなければ、全て空文字のJSONを返してください。日記に書かれていないことを創作しないでください。",
    "",
    "以下のJSON形式のみで出力してください。説明文やMarkdown装飾は不要です。",
    "{",
    '  "title": "実績のタイトル(1行)",',
    '  "challenge": "取り組んだ課題",',
    '  "action": "実際に行った行動",',
    '  "result": "得られた結果",',
    '  "metricValue": "数値的な根拠(わかれば。例: 作業時間を30%削減。なければ空文字)",',
    '  "skillsUsed": "使用したスキル(カンマ区切り)",',
    '  "missingEvidenceHint": ["この日記だけでは確認できない項目(例: 定量的な数値が書かれていない、担当範囲が不明等)。無ければ空配列"]',
    "}",
    "",
    `カテゴリ: ${entry.category.label}`,
    "日記本文:",
    entry.content,
  ].join("\n");

  let draft: AchievementDraft | null = null;
  try {
    const reply = await chatWithOllama([{ role: "user", content: prompt }]);
    draft = parseDraft(reply);
  } catch {
    return NextResponse.json(
      { error: "ローカルAI(Ollama)に接続できませんでした。`ollama serve` が起動しているか確認してください。" },
      { status: 503 },
    );
  }

  if (!draft) {
    return NextResponse.json(
      { error: "抽出に失敗しました。AIの応答を解析できませんでした。手動で実績を登録してください。" },
      { status: 422 },
    );
  }

  // この日記から既に実績が登録されている場合は、二重登録の判断材料として一覧を返す(自動では防止しない)。
  const existingAchievements = await prisma.achievement.findMany({
    where: { sourceDiaryEntryId: entry.id },
    select: { title: true },
  });

  return NextResponse.json({
    draft,
    categoryId: entry.categoryId,
    date: entry.date,
    sourceDiaryEntryId: entry.id,
    existingAchievementTitles: existingAchievements.map((a) => a.title),
  });
}
