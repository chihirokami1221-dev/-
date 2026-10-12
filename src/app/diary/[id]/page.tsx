import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { ExtractAchievementButton } from "@/components/diary/ExtractAchievementButton";
import { BackButton } from "@/components/ui/BackButton";
import { formatJP } from "@/lib/dateUtils";

export default async function DiaryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = await prisma.diaryEntry.findUnique({
    where: { id },
    include: { category: true, extractedAchievements: true },
  });
  if (!entry) notFound();

  return (
    <div className="max-w-2xl">
      <BackButton />
      <div className="mb-4 flex items-center gap-2">
        <Badge color={entry.category.color}>{entry.category.label}</Badge>
        <span className="text-sm text-slate-500">{formatJP(new Date(entry.date))}</span>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="whitespace-pre-wrap text-sm text-slate-800">{entry.content}</p>
      </div>

      {entry.aiAnalysisNote && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="mb-1 text-sm font-medium text-slate-500">分析メモ</div>
          <p className="whitespace-pre-wrap text-sm text-slate-800">{entry.aiAnalysisNote}</p>
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-2 text-sm font-medium text-slate-500">実績候補</div>
        {entry.extractedAchievements.length > 0 && (
          <ul className="mb-3 flex flex-col gap-1">
            {entry.extractedAchievements.map((a) => (
              <li key={a.id} className="text-sm text-slate-700">
                ✓ 登録済み:{" "}
                <Link href={`/achievements/${a.id}/edit`} className="underline">
                  {a.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <ExtractAchievementButton diaryEntryId={entry.id} />
        <p className="mt-2 text-xs text-slate-400">
          AIが日記から実績候補を抽出します。内容は確認・編集画面を経てから登録されるため、自動で実績として加点されることはありません。
        </p>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <DeleteButton apiPath={`/api/diary/${entry.id}`} redirectTo="/diary" />
        <Link href={`/diary/${entry.id}/edit`}>
          <Button variant="secondary">編集する</Button>
        </Link>
      </div>
    </div>
  );
}
