import Link from "next/link";
import { AxisScoreResult } from "@/lib/marketValue/score";
import { AxisDefinition } from "@/lib/marketValue/axes";
import { formatJP } from "@/lib/dateUtils";

const STATUS_LABEL: Record<AxisScoreResult["status"], string> = {
  scored: "評価済み",
  insufficient_evidence: "根拠不足",
  not_evaluated: "未評価",
};

const STATUS_COLOR: Record<AxisScoreResult["status"], string> = {
  scored: "bg-slate-100 text-slate-700",
  insufficient_evidence: "bg-amber-100 text-amber-700",
  not_evaluated: "bg-slate-100 text-slate-400",
};

export function AxisCard({ def, result }: { def: AxisDefinition; result: AxisScoreResult }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">{def.label}</h3>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[result.status]}`}>
            {STATUS_LABEL[result.status]}
          </span>
          <span className="text-lg font-bold text-slate-900">{result.score}</span>
        </div>
      </div>
      <p className="mb-1 text-xs text-slate-500">{def.description}</p>
      <p className="mb-3 text-xs text-slate-400">{def.scoringNote}</p>

      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-slate-900" style={{ width: `${result.score}%` }} />
      </div>

      <div className="mb-3">
        <div className="mb-1 text-xs font-medium text-slate-500">根拠(紐づく実績)</div>
        {result.evidence.length === 0 ? (
          <p className="text-xs text-slate-400">まだ実績が登録されていません。</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {result.evidence.slice(0, 5).map((e) => (
              <li key={e.achievementId} className="text-xs text-slate-600">
                <Link href={`/achievements/${e.achievementId}/edit`} className="underline">
                  {e.title}
                </Link>
                <span className="text-slate-400"> ({formatJP(new Date(e.date))})</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {result.missingEvidence.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 text-xs font-medium text-amber-700">不足している証拠</div>
          <ul className="flex flex-col gap-1">
            {result.missingEvidence.map((m, i) => (
              <li key={i} className="text-xs text-amber-700">
                ・{m}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <div className="mb-1 text-xs font-medium text-slate-500">次に必要な行動</div>
        <p className="text-xs text-slate-600">{def.nextActionGuide}</p>
      </div>
    </div>
  );
}
