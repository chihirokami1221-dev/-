import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeMarketValue } from "@/lib/marketValue/score";
import { evaluateStage } from "@/lib/marketValue/stages";
import { Card } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { StageLadder } from "@/components/market-value/StageLadder";
import { StageConditionList } from "@/components/market-value/StageConditionList";
import { RecalculateButton } from "@/components/market-value/RecalculateButton";
import { formatJP } from "@/lib/dateUtils";

export default async function MarketValuePage() {
  await connection();
  const data = await computeMarketValue();
  const stageEval = evaluateStage(data);
  const snapshots = await prisma.marketValueScoreSnapshot.findMany({
    orderBy: { computedAt: "desc" },
    take: 6,
  });
  const latestSnapshot = snapshots[0] ?? null;

  const diff = latestSnapshot ? Math.round((data.normalizedScore - latestSnapshot.totalScore) * 10) / 10 : null;

  // 最もスコアが低い(=伸ばす余地が大きい)軸を「次に優先して取り組む行動」として提示する。
  const lowestAxis = Object.values(data.axisScores).sort((a, b) => a.score - b.score)[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">市場価値ステップアップ</h1>
        <div className="flex items-center gap-2">
          <Link href="/market-value/market-data" className="text-sm text-slate-600 underline">
            市場データを管理
          </Link>
          <Link href="/market-value/axes" className="text-sm text-slate-600 underline">
            5軸の詳細を見る
          </Link>
          <RecalculateButton />
        </div>
      </div>

      <p className="text-sm text-slate-600">
        総合スコアは5軸の平均値(各軸0〜100点)。根拠が無い軸は0点として扱い、学習しただけでは上がりません。各軸の計算式は
        <Link href="/market-value/axes" className="underline">
          5軸の詳細
        </Link>
        を参照してください。
      </p>

      <Card className="border-slate-200 bg-slate-50">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">日常の使い方</h2>
        <ol className="flex flex-col gap-2 text-sm text-slate-700">
          <li>
            <span className="font-semibold">① 毎日: </span>
            <Link href="/diary" className="underline">
              日記
            </Link>
            に業務の出来事を書く。
          </li>
          <li>
            <span className="font-semibold">② 成果が出たら: </span>
            日記からAIが抽出した実績候補を確認して登録するか、
            <Link href="/achievements/new" className="underline">
              実績データベース
            </Link>
            に直接登録する。登録時に「関連する市場価値の軸」にタグ付けする(これが5軸のスコアの元になる)。
          </li>
          <li>
            <span className="font-semibold">③ 求人情報を見つけたら: </span>
            <Link href="/market-value/market-data" className="underline">
              市場データ
            </Link>
            に手動登録する(市場需要軸と、下の「市場要求とのギャップ」に使われる。無くても他の4軸は評価できる)。
          </li>
          <li>
            <span className="font-semibold">④ 週1〜月1回: </span>
            このページで「現在のスコアを記録する」ボタンを押し、現在地とステージの変化を記録する。
          </li>
        </ol>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <StatTile
            label="市場価値スコア(0-100)"
            value={`${Math.round(data.normalizedScore)}`}
            sub={
              diff === null
                ? "まだ記録がありません。「現在のスコアを記録する」で最初の記録を残せます。"
                : `前回記録比 ${diff > 0 ? "+" : ""}${diff}`
            }
          />
          <StatTile label="登録実績数" value={data.totalAchievementCount} />
          <StatTile label="根拠のある再現性実績" value={data.totalReproducibleCount} />
          <StatTile label="第三者評価のある実績" value={data.totalThirdPartyCount} />
        </div>
      </Card>

      {lowestAxis && (
        <Card className="border-amber-200 bg-amber-50">
          <h2 className="mb-1 text-sm font-semibold text-amber-800">次に優先して取り組む行動</h2>
          <p className="text-sm text-amber-900">
            「{lowestAxis.label}」軸が現在最も伸ばす余地があります。
            {lowestAxis.missingEvidence[0] ?? "実績を登録し、この軸に紐づけましょう。"}
          </p>
        </Card>
      )}

      {data.gapSkills.length > 0 && (
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-slate-600">市場要求とのギャップ</h2>
          <p className="mb-2 text-xs text-slate-500">
            登録した市場データで求められているが、まだ実績のスキルと一致していないもの。
          </p>
          <div className="flex flex-wrap gap-1">
            {data.gapSkills.map((s) => (
              <span key={s} className="rounded-full bg-rose-50 px-2 py-0.5 text-xs text-rose-700">
                {s}
              </span>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-slate-600">ステージ(LEVEL1〜8)</h2>
          <StageLadder currentLevel={stageEval.currentLevel} />
        </Card>
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-slate-600">次のステージへの条件</h2>
          <StageConditionList
            nextStageTitle={stageEval.nextStage?.title ?? null}
            conditions={stageEval.nextStageConditionStatus}
          />
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-600">記録の履歴(直近{snapshots.length}件)</h2>
        {snapshots.length === 0 ? (
          <p className="text-xs text-slate-400">まだ記録がありません。</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {snapshots.map((s) => (
              <li key={s.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{formatJP(s.computedAt)}</span>
                  <span className="font-semibold text-slate-700">スコア {Math.round(s.totalScore)} / LEVEL {s.stageLevel}</span>
                </div>
                {s.reasonNote && <p className="mt-1 text-xs text-slate-600">{s.reasonNote}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
