import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MemoForm } from "@/components/memo/MemoForm";
import { BackButton } from "@/components/ui/BackButton";

export default async function EditMemoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const memo = await prisma.memo.findUnique({ where: { id } });
  if (!memo) notFound();

  return (
    <div className="max-w-2xl">
      <BackButton />
      <h1 className="mb-6 text-2xl font-bold text-slate-900">メモを編集</h1>
      <MemoForm initial={memo} />
    </div>
  );
}
