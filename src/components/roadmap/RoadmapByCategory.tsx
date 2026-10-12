import { LongTermPolicyEditor } from "./LongTermPolicyEditor";
import { PhaseEditor } from "./PhaseEditor";
import { NewPhaseForm } from "./NewPhaseForm";

interface CategoryOption {
  id: string;
  label: string;
  color: string;
  longTermPlan: string;
}

interface KeyAction {
  id: string;
  title: string;
  note: string;
  startDate: string | null;
  dueDate: string | null;
  sortOrder: number;
}

interface PhaseItem {
  id: string;
  title: string;
  startDate: string | null;
  dueDate: string | null;
  categoryId: string;
  keyActions: KeyAction[];
}

// 階層: 分野 → 長期指針 → 計画ブロック(期間+タイトル) → 各ブロック内の行動。
// すべてこの画面内で作成・編集・削除でき、別タブへの再入力を発生させない。
// 予定(イベント)は画面右上のスケジュールアイコンのモーダルで一括管理する。
export function RoadmapByCategory({
  categories,
  items,
}: {
  categories: CategoryOption[];
  items: PhaseItem[];
}) {
  return (
    <div className="flex flex-col gap-10">
      {categories.map((category) => {
        const phases = items
          .filter((item) => item.categoryId === category.id)
          .sort((a, b) => {
            if (!a.startDate && !b.startDate) return 0;
            if (!a.startDate) return 1;
            if (!b.startDate) return -1;
            return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
          });

        return (
          <section key={category.id} id={`category-${category.id}`}>
            <div className="mb-3 flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: category.color }} />
              <h2 className="text-lg font-bold text-slate-800">{category.label}</h2>
            </div>

            <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">長期指針</div>
              <LongTermPolicyEditor categoryId={category.id} initialValue={category.longTermPlan} />
            </div>

            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                計画ブロック({phases.length}件)
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {phases.map((phase) => (
                <PhaseEditor key={phase.id} phase={phase} />
              ))}
              <NewPhaseForm categoryId={category.id} />
            </div>
          </section>
        );
      })}
    </div>
  );
}
