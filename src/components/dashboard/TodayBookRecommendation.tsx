import { getTodayBook, pickCategoryForBook } from "@/lib/bookRecommendations";
import { Card } from "@/components/ui/Card";

interface Category {
  id: string;
  key: string;
  label: string;
  color: string;
}

interface Progress {
  categoryId: string;
  progressPercent: number | null;
}

export function TodayBookRecommendation({ categories, progresses }: { categories: Category[]; progresses: Progress[] }) {
  const targetCategory = pickCategoryForBook(categories, progresses);
  const book = targetCategory ? getTodayBook(targetCategory.key) : null;
  if (!targetCategory || !book) return null;

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-600">今日のおすすめ本</h2>
        <span
          className="rounded-full px-2 py-1 text-[10px] font-semibold text-white"
          style={{ backgroundColor: targetCategory.color }}
        >
          {targetCategory.label}
        </span>
      </div>
      <p className="font-semibold text-slate-900">{book.title}</p>
      <p className="mt-0.5 text-xs text-slate-500">{book.author}</p>
      <p className="mt-2 text-sm text-slate-600">{book.reason}</p>
    </Card>
  );
}
