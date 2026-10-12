import Link from "next/link";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export function DiaryCalendar({
  year,
  month, // 1-12
  countByDate, // key: "YYYY-MM-DD"
}: {
  year: number;
  month: number;
  countByDate: Record<string, number>;
}) {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startWeekday = (firstDay.getDay() + 6) % 7; // 月曜始まり

  const cells: (number | null)[] = Array(startWeekday).fill(null);
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const nextMonth = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <Link
          href={`/diary?month=${prevMonth.y}-${pad(prevMonth.m)}`}
          className="rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
        >
          ← 前月
        </Link>
        <span className="font-semibold text-slate-900">
          {year}年 {month}月
        </span>
        <Link
          href={`/diary?month=${nextMonth.y}-${pad(nextMonth.m)}`}
          className="rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
        >
          次月 →
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-400">
        {["月", "火", "水", "木", "金", "土", "日"].map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const key = `${year}-${pad(month)}-${pad(d)}`;
          const count = countByDate[key] ?? 0;
          return (
            <div
              key={i}
              className={`flex aspect-square flex-col items-center justify-center rounded-lg text-sm ${
                count > 0 ? "bg-slate-900 text-white" : "text-slate-600"
              }`}
            >
              <span>{d}</span>
              {count > 0 && <span className="text-[10px]">●</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
