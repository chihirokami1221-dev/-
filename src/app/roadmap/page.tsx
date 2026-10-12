import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { RoadmapTimeline } from "@/components/roadmap/RoadmapTimeline";
import { RoadmapByCategory } from "@/components/roadmap/RoadmapByCategory";
import { QuickAddEventButton } from "@/components/roadmap/QuickAddEventButton";

export default async function RoadmapPage() {
  await connection();

  const [categories, phases, events] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.roadmapItem.findMany({
      include: { keyActions: { where: { archived: false }, orderBy: { sortOrder: "asc" } } },
      orderBy: [{ startDate: "asc" }],
    }),
    prisma.event.findMany({ orderBy: { date: "asc" } }),
  ]);

  const items = phases.map((p) => ({
    ...p,
    startDate: p.startDate ? p.startDate.toISOString() : null,
    dueDate: p.dueDate ? p.dueDate.toISOString() : null,
    keyActions: p.keyActions.map((a) => ({
      ...a,
      startDate: a.startDate ? a.startDate.toISOString() : null,
      dueDate: a.dueDate ? a.dueDate.toISOString() : null,
    })),
  }));

  const eventsForList = events.map((e) => ({ ...e, date: e.date.toISOString() }));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ロードマップ</h1>
          <p className="mt-1 text-sm text-slate-500">
            分野ごとに「長期指針 → 計画ブロック(期間・タイトル) → 行動」をこの画面だけで作成・編集します。
          </p>
        </div>
        <QuickAddEventButton categories={categories} events={eventsForList} />
      </div>

      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <a
            key={c.id}
            href={`#category-${c.id}`}
            className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-600 hover:border-slate-400"
          >
            {c.label}へ
          </a>
        ))}
      </div>

      <div>
        <h2 className="mb-1 text-lg font-bold text-slate-800">タイムライン</h2>
        <p className="mb-2 text-xs text-slate-400">計画ブロックの期間とタイトルのみを時系列で表示します。</p>
        <RoadmapTimeline categories={categories} items={phases} events={events} />
      </div>

      <RoadmapByCategory categories={categories} items={items} />
    </div>
  );
}
