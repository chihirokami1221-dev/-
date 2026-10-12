import { prisma } from "@/lib/prisma";

export interface CategoryRevenue {
  categoryId: string;
  label: string;
  color: string;
  total: number;
}

export interface MonthRevenue {
  key: string;
  label: string;
  total: number;
}

export interface RevenueSummary {
  // 通貨ごとの合計(収益額が入力された実績のみ対象。未入力(null)は合計に含めない。0円は含める)。
  totalsByCurrency: { currency: string; total: number }[];
  // カテゴリー別・月別の内訳は、通貨混在による誤算を避けるため主要通貨(JPY)のみを対象にする。
  byCategory: CategoryRevenue[];
  byMonth: MonthRevenue[];
  hasOtherCurrency: boolean;
}

const PRIMARY_CURRENCY = "JPY";

export async function computeRevenueSummary(
  categories: { id: string; label: string; color: string }[],
): Promise<RevenueSummary> {
  const achievements = await prisma.achievement.findMany({
    where: { revenueAmount: { not: null } },
    select: { revenueAmount: true, revenueCurrency: true, categoryId: true, date: true },
  });

  const currencyTotals = new Map<string, number>();
  for (const a of achievements) {
    const cur = a.revenueCurrency || PRIMARY_CURRENCY;
    currencyTotals.set(cur, (currencyTotals.get(cur) ?? 0) + (a.revenueAmount ?? 0));
  }

  const primaryAchievements = achievements.filter((a) => (a.revenueCurrency || PRIMARY_CURRENCY) === PRIMARY_CURRENCY);

  const byCategory: CategoryRevenue[] = categories.map((c) => ({
    categoryId: c.id,
    label: c.label,
    color: c.color,
    total: primaryAchievements
      .filter((a) => a.categoryId === c.id)
      .reduce((sum, a) => sum + (a.revenueAmount ?? 0), 0),
  }));

  const now = new Date();
  const byMonth: MonthRevenue[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${d.getFullYear()}年${d.getMonth() + 1}月`;
    const total = primaryAchievements
      .filter((a) => {
        const ad = new Date(a.date);
        return ad.getFullYear() === d.getFullYear() && ad.getMonth() === d.getMonth();
      })
      .reduce((sum, a) => sum + (a.revenueAmount ?? 0), 0);
    byMonth.push({ key, label, total });
  }

  return {
    totalsByCurrency: [...currencyTotals.entries()].map(([currency, total]) => ({ currency, total })),
    byCategory,
    byMonth,
    hasOtherCurrency: [...currencyTotals.keys()].some((c) => c !== PRIMARY_CURRENCY),
  };
}
