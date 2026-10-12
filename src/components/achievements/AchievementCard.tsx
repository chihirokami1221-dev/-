import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { formatJP } from "@/lib/dateUtils";
import { getAxisDefinition, AxisKey } from "@/lib/marketValue/axes";

interface AchievementCardItem {
  id: string;
  title: string;
  result: string;
  metricValue: string | null;
  thirdPartyFeedback: string;
  revenueAmount: number | null;
  revenueCurrency: string;
  date: Date;
  category: { label: string; color: string };
  axisLinks: { axisKey: string }[];
}

const CURRENCY_SYMBOL: Record<string, string> = { JPY: "円", USD: "$" };

function formatRevenue(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOL[currency] ?? currency;
  const formatted = amount.toLocaleString("ja-JP");
  return currency === "USD" ? `${symbol}${formatted}` : `${formatted}${symbol}`;
}

export function AchievementCard({ item }: { item: AchievementCardItem }) {
  return (
    <Link href={`/achievements/${item.id}/edit`}>
      <div className="rounded-xl border border-slate-200 bg-white p-4 hover:shadow-md">
        <div className="mb-2 flex items-center gap-2">
          <Badge color={item.category.color}>{item.category.label}</Badge>
          <span className="text-xs text-slate-500">{formatJP(new Date(item.date))}</span>
        </div>
        <h3 className="mb-1 font-semibold text-slate-900">{item.title}</h3>
        {item.result && <p className="mb-2 text-sm text-slate-600">{item.result}</p>}
        {item.metricValue && (
          <p className="mb-1 text-sm font-medium text-slate-800">数値: {item.metricValue}</p>
        )}
        {item.revenueAmount !== null && (
          <p className="mb-2 text-sm font-medium text-slate-800">
            収益: {formatRevenue(item.revenueAmount, item.revenueCurrency)}
          </p>
        )}
        {item.axisLinks.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.axisLinks.map((l) => (
              <span key={l.axisKey} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {getAxisDefinition(l.axisKey as AxisKey).label}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
