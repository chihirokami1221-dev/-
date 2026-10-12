export type TimelineZoom = "3m" | "6m" | "1y" | "all";

export interface TimelineRange {
  start: Date;
  end: Date; // exclusive
}

export interface TimelineDatedItem {
  id: string;
  startDate: Date | null;
  dueDate: Date | null;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date: Date, n: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + n, date.getDate());
}

// dateがfromから何ヶ月目か(小数)を返す。ピクセル位置の計算に使う。
export function monthsBetween(from: Date, date: Date): number {
  const yearDiff = date.getFullYear() - from.getFullYear();
  const monthDiff = date.getMonth() - from.getMonth();
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const dayFraction = (date.getDate() - 1) / daysInMonth;
  return yearDiff * 12 + monthDiff + dayFraction;
}

export function monthsInRange(range: TimelineRange): Date[] {
  const months: Date[] = [];
  let cursor = startOfMonth(range.start);
  while (cursor < range.end) {
    months.push(cursor);
    cursor = addMonths(cursor, 1);
  }
  return months;
}

// 日付が設定されているすべての項目(+今日)を含む最小範囲(月初〜月初)を求める。全期間表示用。
export function computeAllRange(items: TimelineDatedItem[], today: Date = new Date()): TimelineRange {
  const dates: Date[] = [today];
  for (const item of items) {
    if (item.startDate) dates.push(new Date(item.startDate));
    if (item.dueDate) dates.push(new Date(item.dueDate));
  }

  const min = new Date(Math.min(...dates.map((d) => d.getTime())));
  const max = new Date(Math.max(...dates.map((d) => d.getTime())));

  return {
    start: startOfMonth(min),
    end: addMonths(startOfMonth(max), 1),
  };
}

export function computeRangeForZoom(zoom: TimelineZoom, items: TimelineDatedItem[], today: Date = new Date()): TimelineRange {
  if (zoom === "all") return computeAllRange(items, today);

  const monthsMap: Record<Exclude<TimelineZoom, "all">, number> = { "3m": 3, "6m": 6, "1y": 12 };
  const start = startOfMonth(today);
  return { start, end: addMonths(start, monthsMap[zoom]) };
}

export interface StackedRow<T> {
  rowIndex: number;
  item: T;
}

// 期間が重なる項目を複数行に積み上げて配置する(ガントチャートのレーン割り当て)。
export function stackByDateRange<T extends { startDate: Date; dueDate: Date }>(items: T[]): StackedRow<T>[] {
  const sorted = [...items].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  const rowEnds: number[] = [];
  const result: StackedRow<T>[] = [];

  for (const item of sorted) {
    let rowIndex = rowEnds.findIndex((end) => end <= item.startDate.getTime());
    if (rowIndex === -1) {
      rowIndex = rowEnds.length;
      rowEnds.push(item.dueDate.getTime());
    } else {
      rowEnds[rowIndex] = item.dueDate.getTime();
    }
    result.push({ rowIndex, item });
  }

  return result;
}
