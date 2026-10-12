import { MarketDataForm } from "@/components/market-value/MarketDataForm";
import { BackButton } from "@/components/ui/BackButton";

export default function NewMarketDataPage() {
  return (
    <div className="max-w-2xl">
      <BackButton />
      <h1 className="mb-6 text-2xl font-bold text-slate-900">市場データを登録</h1>
      <MarketDataForm />
    </div>
  );
}
