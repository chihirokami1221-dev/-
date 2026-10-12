import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { AchievementCard } from "@/components/achievements/AchievementCard";

export default async function AchievementsPage({
  searchParams,
}: {
  searchParams: Promise<{ categoryId?: string }>;
}) {
  const { categoryId } = await searchParams;

  const [categories, achievements] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.achievement.findMany({
      where: { categoryId: categoryId || undefined },
      include: { category: true, axisLinks: true },
      orderBy: { date: "desc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">実績データベース</h1>
        <Link href="/achievements/new">
          <Button>+ 実績を登録</Button>
        </Link>
      </div>

      <div className="flex gap-2">
        <Link
          href="/achievements"
          className={`rounded-full px-3 py-1 text-sm ${
            !categoryId ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-300"
          }`}
        >
          すべて
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/achievements?categoryId=${c.id}`}
            className={`rounded-full px-3 py-1 text-sm ${
              categoryId === c.id ? "text-white" : "bg-white text-slate-600 border border-slate-300"
            }`}
            style={categoryId === c.id ? { backgroundColor: c.color } : undefined}
          >
            {c.label}
          </Link>
        ))}
      </div>

      {achievements.length === 0 ? (
        <EmptyState message="まだ実績が登録されていません。最初の実績を登録しましょう。" />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {achievements.map((a) => (
            <AchievementCard key={a.id} item={a} />
          ))}
        </div>
      )}
    </div>
  );
}
