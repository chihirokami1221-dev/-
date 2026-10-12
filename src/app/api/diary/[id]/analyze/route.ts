import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { chatWithOllama } from "@/lib/ollama";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = await prisma.diaryEntry.findUnique({ where: { id }, include: { category: true } });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const prompt = [
    `以下はユーザーの日記です(カテゴリ: ${entry.category.label})。`,
    "この日記を読んで、①気づき・良かった点、②改善のヒント、③次に取るべき小さな行動、の3点を日本語で簡潔に(各1〜2文)まとめてください。",
    "",
    entry.content,
  ].join("\n");

  let analysis: string;
  try {
    analysis = await chatWithOllama([{ role: "user", content: prompt }]);
  } catch {
    return NextResponse.json(
      { error: "ローカルAI(Ollama)に接続できませんでした。`ollama serve` が起動しているか確認してください。" },
      { status: 503 },
    );
  }

  const updated = await prisma.diaryEntry.update({
    where: { id },
    data: { aiAnalysis: analysis || "(AIからの応答が空でした)" },
  });

  return NextResponse.json(updated);
}
