import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DiaryForm } from "@/components/diary/DiaryForm";
import { BackButton } from "@/components/ui/BackButton";

export default async function EditDiaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [categories, entry] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.diaryEntry.findUnique({ where: { id } }),
  ]);

  if (!entry) notFound();

  return (
    <div className="max-w-2xl">
      <BackButton />
      <h1 className="mb-6 text-2xl font-bold text-slate-900">日記を編集</h1>
      <DiaryForm categories={categories} initial={entry} />
    </div>
  );
}
