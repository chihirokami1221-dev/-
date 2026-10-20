import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/Button";
import { DiaryCalendar } from "@/components/diary/DiaryCalendar";
import { DiaryList } from "@/components/diary/DiaryList";
import { DiarySearchBar } from "@/components/diary/DiarySearchBar";

export default async function DiaryPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; keyword?: string; categoryId?: string }>;
}) {
  const { month, keyword, categoryId } = await searchParams;

  const isSearchMode = Boolean(keyword || categoryId);

  if (isSearchMode) {
    // categories・entriesは互いに依存しないクエリのため並列実行する。
    const [categories, entries] = await Promise.all([
      prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.diaryEntry.findMany({
        where: {
          categoryId: categoryId || undefined,
          content: keyword ? { contains: keyword } : undefined,
        },
        include: { category: true },
        orderBy: { date: "desc" },
      }),
    ]);

    return (
      <div className="flex flex-col gap-6">
        <Header />
        <DiarySearchBar categories={categories} defaultKeyword={keyword} defaultCategoryId={categoryId} />
        <DiaryList entries={entries} />
      </div>
    );
  }

  const now = new Date();
  const [yearStr, monthStr] = (month ?? `${now.getFullYear()}-${now.getMonth() + 1}`).split("-");
  const year = Number(yearStr);
  const monthNum = Number(monthStr);

  const rangeStart = new Date(year, monthNum - 1, 1, 0, 0, 0, 0);
  const rangeEnd = new Date(year, monthNum, 0, 23, 59, 59, 999);

  // categories・entriesは互いに依存しないクエリのため並列実行する。
  const [categories, entries] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.diaryEntry.findMany({
      where: { date: { gte: rangeStart, lte: rangeEnd } },
      include: { category: true },
      orderBy: { date: "desc" },
    }),
  ]);

  const countByDate: Record<string, number> = {};
  for (const entry of entries) {
    const key = new Date(entry.date).toISOString().slice(0, 10);
    countByDate[key] = (countByDate[key] ?? 0) + 1;
  }

  return (
    <div className="flex flex-col gap-6">
      <Header />
      <DiarySearchBar categories={categories} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DiaryCalendar year={year} month={monthNum} countByDate={countByDate} />
        <DiaryList entries={entries} />
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold text-slate-900">日記</h1>
      <Link href="/diary/new">
        <Button>+ 今日を記録する</Button>
      </Link>
    </div>
  );
}
