import { connection } from "next/server";
import { computeMarketValue } from "@/lib/marketValue/score";
import { AXIS_DEFINITIONS } from "@/lib/marketValue/axes";
import { AxisCard } from "@/components/market-value/AxisCard";
import { BackButton } from "@/components/ui/BackButton";

export default async function MarketValueAxesPage() {
  await connection();
  const data = await computeMarketValue();

  return (
    <div className="flex flex-col gap-6">
      <BackButton />
      <h1 className="text-2xl font-bold text-slate-900">市場価値 5軸評価</h1>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <p className="font-medium text-slate-700">各軸のスコア(0〜100点)について</p>
        <p className="mt-2 text-xs text-slate-500">
          「学習しただけ」「知っているだけ」は実績として登録しない限り加点されません。根拠(再現性の説明・第三者評価コメント・市場データとの一致)が無い軸は「未評価」または「根拠不足」と表示し、0点として扱います。各軸の計算式は下のカードをご確認ください。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {AXIS_DEFINITIONS.map((def) => (
          <AxisCard key={def.key} def={def} result={data.axisScores[def.key]} />
        ))}
      </div>
    </div>
  );
}
