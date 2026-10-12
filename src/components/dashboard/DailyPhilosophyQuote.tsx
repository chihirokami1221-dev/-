import { getTodayQuote } from "@/lib/philosopherQuotes";
import { Card } from "@/components/ui/Card";

export function DailyPhilosophyQuote() {
  const quote = getTodayQuote();

  return (
    <Card className="border-slate-200 bg-gradient-to-br from-slate-50 via-white to-amber-50/60">
      <div className="flex items-center gap-4">
        <svg
          viewBox="0 0 64 64"
          className="h-14 w-14 shrink-0 text-slate-400"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="32" cy="18" r="10" />
          <path d="M14 54c0-12 8-20 18-20s18 8 18 20" />
          <path d="M8 50c4-14 10-18 10-18M56 50c-4-14-10-18-10-18" />
        </svg>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-6 text-slate-800">{quote.text}</p>
          <p className="mt-1 text-xs text-slate-500">— {quote.author}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">{quote.meaning}</p>
        </div>
      </div>
    </Card>
  );
}
