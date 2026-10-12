import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatJP } from "@/lib/dateUtils";

interface DiaryListItem {
  id: string;
  date: Date;
  content: string;
  category: { label: string; color: string };
}

export function DiaryList({ entries }: { entries: DiaryListItem[] }) {
  if (entries.length === 0) {
    return <EmptyState message="該当する日記がありません。" />;
  }

  return (
    <div className="flex flex-col gap-3">
      {entries.map((entry) => (
        <Link key={entry.id} href={`/diary/${entry.id}`}>
          <div className="rounded-xl border border-slate-200 bg-white p-4 hover:shadow-md">
            <div className="mb-2 flex items-center gap-2">
              <Badge color={entry.category.color}>{entry.category.label}</Badge>
              <span className="text-xs text-slate-500">{formatJP(new Date(entry.date))}</span>
            </div>
            <p className="line-clamp-2 text-sm text-slate-700">{entry.content}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
