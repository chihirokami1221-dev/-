import { Card } from "@/components/ui/Card";
import type { RevenueSummary } from "@/lib/revenueSummary";

const CURRENCY_SYMBOL: Record<string, string> = { JPY: "円", USD: "$" };

function formatAmount(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOL[currency] ?? currency;
  const formatted = Math.round(amount).toLocaleString("ja-JP");
  return currency === "USD" ? `${symbol}${formatted}` : `${formatted}${symbol}`;
}

export function RevenueSummaryCard({ summary }: { summary: RevenueSummary }) {
  const primaryTotal = summary.totalsByCurrency.find((t) => t.currency === "JPY")?.total ?? 0;
  const hasAnyRevenue = summary.totalsByCurrency.length > 0;

  return (
    <Card>
      <h2 className="mb-1 text-sm font-semibold text-slate-600">収益サマリー</h2>
      <p className="mb-4 text-xs text-slate-400">実績に記録した収益額の集計(金額が未入力の実績は含みません)。</p>

      {!hasAnyRevenue ? (
        <p className="text-sm text-slate-400">まだ収益が記録された実績がありません。</p>
      ) : (
        <>
          <div className="mb-4 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">{formatAmount(primaryTotal, "JPY")}</span>
            <span className="text-xs text-slate-400">合計</span>
          </div>

          {summary.hasOtherCurrency && (
            <div className="mb-4 flex flex-wrap gap-2 text-xs text-slate-500">
              {summary.totalsByCurrency
                .filter((t) => t.currency !== "JPY")
                .map((t) => (
                  <span key={t.currency}>
                    他通貨: {formatAmount(t.total, t.currency)}
                  </span>
                ))}
            </div>
          )}

          <div className="mb-4 grid grid-cols-3 gap-2">
            {summary.byCategory.map((c) => (
              <div key={c.categoryId} className="rounded-xl border border-slate-100 bg-slate-50 p-2 text-center">
                <div className="mb-1 flex items-center justify-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="text-xs font-medium text-slate-600">{c.label}</span>
                </div>
                <div className="text-sm font-bold text-slate-800">{formatAmount(c.total, "JPY")}</div>
              </div>
            ))}
          </div>

          <div>
            <div className="mb-2 text-xs font-medium text-slate-500">月別推移(直近6か月)</div>
            <div className="flex items-end gap-1" style={{ height: 64 }}>
              {(() => {
                const max = Math.max(1, ...summary.byMonth.map((m) => m.total));
                return summary.byMonth.map((m) => (
                  <div key={m.key} className="flex flex-1 flex-col items-center gap-1" title={`${m.label}: ${formatAmount(m.total, "JPY")}`}>
                    <div
                      className="w-full rounded-t bg-emerald-400"
                      style={{ height: `${Math.max(2, (m.total / max) * 48)}px` }}
                    />
                    <span className="text-[9px] text-slate-400">{m.label.slice(5)}</span>
                  </div>
                ));
              })()}
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
