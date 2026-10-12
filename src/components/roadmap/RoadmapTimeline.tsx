"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  type TimelineZoom,
  computeRangeForZoom,
  monthsInRange,
  monthsBetween,
  stackByDateRange,
} from "@/lib/roadmapTimeline";

interface TimelineItem {
  id: string;
  title: string;
  categoryId: string;
  startDate: Date | null;
  dueDate: Date | null;
}

interface TimelineCategory {
  id: string;
  label: string;
  color: string;
}

interface TimelineEvent {
  id: string;
  title: string;
  categoryId: string;
  date: Date;
}

const PX_PER_MONTH = 110;
const LABEL_WIDTH = 108;
const ROW_HEIGHT = 34;
const MILESTONE_ROW_HEIGHT = 16;

const ZOOM_OPTIONS: { key: TimelineZoom; label: string }[] = [
  { key: "3m", label: "3か月" },
  { key: "6m", label: "6か月" },
  { key: "1y", label: "1年" },
  { key: "all", label: "全期間" },
];

function formatYM(date: Date): string {
  return `${date.getFullYear()}/${date.getMonth() + 1}`;
}

function formatMD(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function RoadmapTimeline({
  categories,
  items,
  events = [],
}: {
  categories: TimelineCategory[];
  items: TimelineItem[];
  events?: TimelineEvent[];
}) {
  const [zoom, setZoom] = useState<TimelineZoom>("all");
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = useMemo(() => new Date(), []);

  const range = useMemo(() => computeRangeForZoom(zoom, items, today), [zoom, items, today]);
  const months = useMemo(() => monthsInRange(range), [range]);
  const totalMonths = months.length;
  const trackWidth = totalMonths * PX_PER_MONTH;

  const todayOffsetMonths = monthsBetween(range.start, today);
  const todayVisible = todayOffsetMonths >= 0 && todayOffsetMonths <= totalMonths;
  const todayOffsetPx = todayOffsetMonths * PX_PER_MONTH;

  const unscheduledItems = items.filter((i) => !i.startDate && !i.dueDate);

  useEffect(() => {
    if (!scrollRef.current || !todayVisible) return;
    const target = LABEL_WIDTH + todayOffsetPx - 80;
    scrollRef.current.scrollLeft = Math.max(0, target);
  }, [zoom, todayOffsetPx, todayVisible]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          本業・副業・音楽の長期計画を時間軸で表示します。期間未設定の項目はタイムラインには表示されません。
        </p>
        <div className="flex gap-1 rounded-full bg-slate-100 p-1">
          {ZOOM_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setZoom(opt.key)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                zoom === opt.key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* デスクトップ・タブレット: ガントチャート */}
      <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white md:block">
        <div ref={scrollRef} className="overflow-x-auto">
          <div style={{ width: LABEL_WIDTH + trackWidth }}>
            <div className="flex border-b border-slate-200 bg-white">
              <div className="sticky left-0 z-20 shrink-0 bg-white" style={{ width: LABEL_WIDTH }} />
              {months.map((m, i) => (
                <div
                  key={i}
                  className="shrink-0 border-l border-slate-100 py-2 text-center text-xs font-semibold text-slate-500"
                  style={{ width: PX_PER_MONTH }}
                >
                  {formatYM(m)}
                </div>
              ))}
            </div>

            <div className="relative">
              {todayVisible && (
                <div
                  className="pointer-events-none absolute top-0 bottom-0 z-10 border-l-2 border-red-400"
                  style={{ left: LABEL_WIDTH + todayOffsetPx }}
                />
              )}

              {categories.map((category) => {
                const categoryItems = items.filter((i) => i.categoryId === category.id);
                const categoryEvents = events.filter((e) => e.categoryId === category.id);

                const bars = categoryItems
                  .filter((i): i is TimelineItem & { startDate: Date; dueDate: Date } => !!i.startDate && !!i.dueDate)
                  .map((i) => ({ ...i, startDate: new Date(i.startDate), dueDate: new Date(i.dueDate) }))
                  .filter((i) => i.dueDate >= range.start && i.startDate <= range.end);

                const milestones = categoryItems.filter((i) => (!!i.startDate) !== (!!i.dueDate));

                const stacked = stackByDateRange(bars);
                const barRowCount = Math.max(1, ...stacked.map((s) => s.rowIndex + 1), 0);
                const milestoneRowHeight = milestones.length > 0 || categoryEvents.length > 0 ? MILESTONE_ROW_HEIGHT : 0;
                const laneHeight = milestoneRowHeight + barRowCount * ROW_HEIGHT;

                return (
                  <div key={category.id} className="flex border-b border-slate-100 last:border-b-0">
                    <div
                      className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-slate-100 bg-white px-2"
                      style={{ width: LABEL_WIDTH, height: laneHeight }}
                    >
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
                      <span className="truncate text-sm font-semibold text-slate-700">{category.label}</span>
                    </div>

                    <div className="relative shrink-0" style={{ width: trackWidth, height: laneHeight }}>
                      {bars.length === 0 && milestones.length === 0 && categoryEvents.length === 0 && (
                        <div className="absolute inset-0 flex items-center px-2 text-xs text-slate-300">
                          期間が設定された目標はありません
                        </div>
                      )}

                      {categoryEvents.map((event) => {
                        const offsetMonths = monthsBetween(range.start, event.date);
                        if (offsetMonths < 0 || offsetMonths > totalMonths) return null;
                        return (
                          <Link
                            key={event.id}
                            href={`/roadmap#category-${category.id}`}
                            className="absolute top-1 -translate-x-1/2"
                            style={{ left: offsetMonths * PX_PER_MONTH }}
                            title={event.title}
                          >
                            <span className="block h-2.5 w-2.5 rounded-full bg-amber-500" />
                          </Link>
                        );
                      })}

                      {milestones.map((item) => {
                        const date = new Date((item.startDate ?? item.dueDate) as Date);
                        const offsetMonths = monthsBetween(range.start, date);
                        if (offsetMonths < 0 || offsetMonths > totalMonths) return null;
                        return (
                          <Link
                            key={item.id}
                            href={`/roadmap/${item.id}`}
                            className="absolute top-1 -translate-x-1/2"
                            style={{ left: offsetMonths * PX_PER_MONTH }}
                            title={item.title}
                          >
                            <span
                              className="block h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: category.color }}
                            />
                          </Link>
                        );
                      })}

                      {stacked.map(({ rowIndex, item }) => {
                        const clampedStart = item.startDate < range.start ? range.start : item.startDate;
                        const clampedEnd = item.dueDate > range.end ? range.end : item.dueDate;
                        const startOffset = Math.max(0, monthsBetween(range.start, clampedStart));
                        const endOffset = Math.min(totalMonths, monthsBetween(range.start, clampedEnd));
                        const left = startOffset * PX_PER_MONTH;
                        const width = Math.max(18, (endOffset - startOffset) * PX_PER_MONTH);

                        return (
                          <Link
                            key={item.id}
                            href={`/roadmap/${item.id}`}
                            className="absolute flex items-center whitespace-nowrap rounded-lg px-2 text-xs font-medium text-white shadow-sm transition-opacity hover:opacity-90"
                            style={{
                              left,
                              minWidth: width,
                              top: milestoneRowHeight + rowIndex * ROW_HEIGHT + 4,
                              height: ROW_HEIGHT - 8,
                              backgroundColor: category.color,
                            }}
                            title={item.title}
                          >
                            {item.title}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* モバイル: 年月ごとの縦並びリスト */}
      <MobileTimelineList categories={categories} items={items} events={events} />

      {unscheduledItems.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-slate-600">時期未設定</p>
          <div className="flex flex-wrap gap-2">
            {unscheduledItems.map((item) => {
              const category = categories.find((c) => c.id === item.categoryId);
              return (
                <Link
                  key={item.id}
                  href={`/roadmap/${item.id}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:border-slate-300"
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: category?.color }} />
                  {item.title}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

type MobileRow =
  | { kind: "phase"; id: string; title: string; categoryId: string; startDate: Date | null; dueDate: Date | null }
  | { kind: "event"; id: string; title: string; categoryId: string; date: Date };

function MobileTimelineList({
  categories,
  items,
  events,
}: {
  categories: TimelineCategory[];
  items: TimelineItem[];
  events: TimelineEvent[];
}) {
  const dated = items.filter((i) => i.startDate || i.dueDate);

  const rows: MobileRow[] = [
    ...dated.map((item): MobileRow => ({ kind: "phase", id: item.id, title: item.title, categoryId: item.categoryId, startDate: item.startDate, dueDate: item.dueDate })),
    ...events.map((e): MobileRow => ({ kind: "event", id: e.id, title: e.title, categoryId: e.categoryId, date: e.date })),
  ];

  const groups = new Map<string, MobileRow[]>();
  for (const row of rows) {
    const d = row.kind === "event" ? row.date : ((row.startDate ?? row.dueDate) as Date);
    const key = `${d.getFullYear()}/${d.getMonth() + 1}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  const sortedKeys = [...groups.keys()].sort((a, b) => {
    const [ay, am] = a.split("/").map(Number);
    const [by, bm] = b.split("/").map(Number);
    return ay * 12 + am - (by * 12 + bm);
  });

  if (sortedKeys.length === 0) {
    return <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-400 md:hidden">期間が設定された目標はまだありません。</p>;
  }

  return (
    <div className="flex flex-col gap-4 md:hidden">
      {sortedKeys.map((key) => (
        <div key={key}>
          <div className="mb-2 text-sm font-bold text-slate-700">{key}</div>
          <div className="flex flex-col gap-2">
            {groups.get(key)!.map((row) => {
              const category = categories.find((c) => c.id === row.categoryId);
              if (row.kind === "event") {
                return (
                  <Link
                    key={`event-${row.id}`}
                    href={`/roadmap#category-${row.categoryId}`}
                    className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/50 px-3 py-2"
                  >
                    <span className="shrink-0 text-amber-500">◇</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{row.title}</span>
                    <span className="shrink-0 text-xs text-slate-400">{formatMD(row.date)}</span>
                  </Link>
                );
              }
              return (
                <Link
                  key={row.id}
                  href={`/roadmap/${row.id}`}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2"
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: category?.color }} />
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{row.title}</span>
                  <span className="shrink-0 text-xs text-slate-400">
                    {row.startDate ? formatMD(new Date(row.startDate)) : "?"}
                    {row.dueDate ? ` 〜 ${formatMD(new Date(row.dueDate))}` : ""}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
