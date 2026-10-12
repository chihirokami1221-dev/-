import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { BackButton } from "@/components/ui/BackButton";
import { formatJP } from "@/lib/dateUtils";

const STALE_DAYS = 90;

export default async function MarketDataPage() {
  await connection();
  const entries = await prisma.marketDataEntry.findMany({ orderBy: { fetchedAt: "desc" } });
  const now = Date.now();

  return (
    <div className="flex flex-col gap-6">
      <BackButton />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">市場データ(求人情報)</h1>
        <Link href="/market-value/market-data/new">
          <Button>+ 市場データを登録</Button>
        </Link>
      </div>

      <p className="text-sm text-slate-600">
        求人・案件情報は自動取得せず、実際に確認できた内容のみ手動で登録します。「市場需要」軸の評価と、不足スキルのギャップ分析に使われます。
      </p>

      {entries.length === 0 ? (
        <EmptyState message="まだ市場データが登録されていません。求人情報を確認したら登録しましょう。" />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {entries.map((e) => {
            const ageDays = Math.floor((now - e.confirmedAt.getTime()) / (1000 * 60 * 60 * 24));
            const isStale = ageDays > STALE_DAYS;
            return (
              <Link
                key={e.id}
                href={`/market-value/market-data/${e.id}/edit`}
                className="rounded-xl border border-slate-200 bg-white p-4 hover:shadow-md"
              >
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">{e.roleTitle}</h3>
                  {isStale && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      情報が古い可能性(確認日から{ageDays}日)
                    </span>
                  )}
                </div>
                {e.requiredSkills && (
                  <p className="mb-1 text-xs text-slate-600">必須: {e.requiredSkills}</p>
                )}
                {e.preferredSkills && (
                  <p className="mb-1 text-xs text-slate-500">歓迎: {e.preferredSkills}</p>
                )}
                {e.compensationRange && (
                  <p className="mb-1 text-xs text-slate-600">報酬: {e.compensationRange}</p>
                )}
                <p className="mt-2 text-xs text-slate-400">
                  {e.sourceLabel || "情報源未記入"} ・ 取得日 {formatJP(e.fetchedAt)} ・ 確認日 {formatJP(e.confirmedAt)}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
