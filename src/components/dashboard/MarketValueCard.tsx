import Link from "next/link";
import { StatTile } from "@/components/ui/StatTile";

export function MarketValueCard({
  score,
  previousScore,
  stageLevel,
  stageTitle,
  nextStageTitle,
}: {
  score: number;
  previousScore: number | null;
  stageLevel: number;
  stageTitle: string;
  nextStageTitle: string | null;
}) {
  const diff = previousScore === null ? null : Math.round((score - previousScore) * 10) / 10;

  return (
    <Link href="/market-value">
      <div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-lime-50 to-amber-50 p-5 shadow-[0_14px_30px_rgba(34,197,94,0.12)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(34,197,94,0.18)]">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-lg shadow-inner">🌿</div>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Growth</span>
          </div>
          <span className="rounded-full border border-emerald-200 bg-white/70 px-2 py-1 text-[10px] font-semibold text-emerald-700">
            {diff === null ? "開始前" : diff >= 0 ? "成長中" : "調整中"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <StatTile
            label="市場価値スコア"
            value={`${Math.round(score)} / 100`}
            sub={
              diff === null
                ? "前回比較データなし"
                : diff === 0
                ? "前回から変化なし"
                : `前回比 ${diff > 0 ? "+" : ""}${diff}`
            }
          />
          <div className="text-right">
            <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-emerald-700">現在のステージ</div>
            <div className="mt-1 text-xl font-black text-slate-900">LEVEL {stageLevel}</div>
            <div className="text-sm font-medium text-slate-700">{stageTitle}</div>
          </div>
        </div>
        {nextStageTitle && (
          <div className="mt-4 rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-xs font-medium text-slate-600">
            次のステージ: <span className="font-bold text-emerald-700">{nextStageTitle}</span>
          </div>
        )}
      </div>
    </Link>
  );
}
