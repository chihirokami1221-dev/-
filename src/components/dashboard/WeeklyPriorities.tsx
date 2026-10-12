import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatJP } from "@/lib/dateUtils";
import { PriorityItem } from "@/lib/weeklyPriorities";

export function WeeklyPriorities({ items, compact = false }: { items: PriorityItem[]; compact?: boolean }) {
  if (items.length === 0) {
    return <EmptyState message="優先度算出の対象となるロードマップがありません。" />;
  }

  return (
    <ol className={`flex flex-col ${compact ? "gap-1.5" : "gap-3"}`}>
      {items.map((item, i) => (
        <li key={item.id}>
          <Link
            href={`/roadmap/${item.id}`}
            className={`block rounded-xl border border-slate-200 bg-white hover:shadow-md ${compact ? "p-2.5" : "p-4"}`}
          >
            <div className="flex items-start gap-2.5">
              <span
                className={`flex shrink-0 items-center justify-center rounded-full bg-slate-900 font-bold text-white ${
                  compact ? "h-5 w-5 text-[10px]" : "h-6 w-6 text-xs"
                }`}
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className={`truncate font-medium text-slate-900 ${compact ? "text-sm" : ""}`}>{item.title}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {item.dueDate ? `期限: ${formatJP(new Date(item.dueDate))}` : "期限未設定"}
                  {!compact && item.reasonTags.length > 0 && ` ・ 理由: ${item.reasonTags.join("、")}`}
                </p>
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ol>
  );
}
