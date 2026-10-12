import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/Button";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { BackButton } from "@/components/ui/BackButton";
import { ArchivedMemoDetail } from "@/components/memo/ArchivedMemoDetail";
import { formatJP } from "@/lib/dateUtils";

export default async function MemoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const memo = await prisma.memo.findUnique({ where: { id } });
  if (!memo) notFound();

  return (
    <div className="max-w-2xl">
      <BackButton />
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{memo.title}</h1>
        <span className="text-xs text-slate-400">更新: {formatJP(memo.updatedAt)}</span>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        {memo.sourceKey ? (
          <ArchivedMemoDetail content={memo.content} />
        ) : (
          <p className="whitespace-pre-wrap text-sm text-slate-800">{memo.content || "(内容はありません)"}</p>
        )}
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <DeleteButton apiPath={`/api/memos/${memo.id}`} redirectTo="/memo" />
        <Link href={`/memo/${memo.id}/edit`}>
          <Button variant="secondary">編集する</Button>
        </Link>
      </div>
    </div>
  );
}
