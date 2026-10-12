import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MarketDataForm } from "@/components/market-value/MarketDataForm";
import { BackButton } from "@/components/ui/BackButton";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { getSkillSuggestions } from "@/lib/skillSuggestions";

export default async function EditMarketDataPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [entry, skillSuggestions] = await Promise.all([
    prisma.marketDataEntry.findUnique({ where: { id } }),
    getSkillSuggestions(),
  ]);
  if (!entry) notFound();

  return (
    <div className="max-w-2xl">
      <BackButton />
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">市場データを編集</h1>
        <DeleteButton apiPath={`/api/market-data/${entry.id}`} redirectTo="/market-value/market-data" />
      </div>
      <MarketDataForm initial={entry} skillSuggestions={skillSuggestions} />
    </div>
  );
}
