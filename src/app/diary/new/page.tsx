import { prisma } from "@/lib/prisma";
import { DiaryForm } from "@/components/diary/DiaryForm";
import { BackButton } from "@/components/ui/BackButton";

export default async function NewDiaryPage() {
  const categories = await prisma.category.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <div className="max-w-2xl">
      <BackButton />
      <h1 className="mb-6 text-2xl font-bold text-slate-900">今日を記録する</h1>
      <DiaryForm categories={categories} />
    </div>
  );
}
