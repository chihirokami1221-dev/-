import { getTodayWord } from "@/lib/dailyEnglishWords";
import { Card } from "@/components/ui/Card";

export function DailyEnglishWord() {
  const word = getTodayWord();

  return (
    <Card className="border-slate-200 bg-gradient-to-br from-sky-50 via-white to-slate-50">
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-sky-100 text-lg font-black text-sky-600">
          EN
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800">
            {word.word} <span className="font-normal text-slate-500">— {word.meaning}</span>
          </p>
          <p className="mt-1 text-xs text-slate-600">{word.example}</p>
          <p className="text-xs text-slate-400">{word.exampleJa}</p>
        </div>
      </div>
    </Card>
  );
}
