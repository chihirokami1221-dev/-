import { getNoRepeatDailyIndex } from "@/lib/dateUtils";

export interface BookRecommendation {
  title: string;
  author: string;
  reason: string;
}

// ハルシネーション防止のため、Web検索で実在・著者名を確認した書籍のみを掲載している(AIが即興で生成した書籍ではない)。
export const BOOK_RECOMMENDATIONS: Record<string, BookRecommendation[]> = {
  main_job: [
    {
      title: "ドリルを売るには穴を売れ",
      author: "佐藤義典",
      reason: "商品ではなく顧客にとっての価値から考えるマーケティングの入門書。",
    },
    {
      title: "影響力の武器",
      author: "ロバート・B・チャルディーニ",
      reason: "人を動かす7つの心理的原理を解説した定番書。接客・販売にも応用できる。",
    },
    {
      title: "USJのジェットコースターはなぜ後ろ向きに走ったのか?",
      author: "森岡毅",
      reason: "マーケティングで事業をV字回復させた実例から学べる一冊。",
    },
  ],
  side_job: [
    {
      title: "金持ち父さん 貧乏父さん",
      author: "ロバート・キヨサキ",
      reason: "資産と負債の違いから、お金の基本的な考え方を学べるベストセラー。",
    },
    {
      title: "リーン・スタートアップ",
      author: "エリック・リース",
      reason: "小さく始めて検証を繰り返す、副業・新規事業の立ち上げ方の定番書。",
    },
    {
      title: "人を操る禁断の文章術",
      author: "メンタリストDaiGo",
      reason: "文章で相手の心を動かすための心理トリガーを解説。",
    },
  ],
  music: [
    {
      title: "絶対音感",
      author: "最相葉月",
      reason: "音楽家・科学者への取材から「絶対音感」の正体に迫るノンフィクション。",
    },
    {
      title: "音楽の聴き方",
      author: "岡田暁生",
      reason: "音楽を聴くとはどういう行為かを問い直す一冊。",
    },
  ],
};

export function getTodayBook(categoryKey: string, date: Date = new Date()): BookRecommendation | null {
  const list = BOOK_RECOMMENDATIONS[categoryKey];
  if (!list || list.length === 0) return null;

  const index = getNoRepeatDailyIndex(date, list.length, `book:${categoryKey}`);
  return list[index];
}

interface CategoryLike {
  id: string;
  key: string;
}

interface ProgressLike {
  categoryId: string;
  progressPercent: number | null;
}

// 今週の進捗(日記ベース)が最も低い領域を「今のびしろがある領域」として、おすすめ本の対象にする。
export function pickCategoryForBook<T extends CategoryLike>(categories: T[], progresses: ProgressLike[]): T | null {
  let target: T | null = null;
  let lowestScore = Infinity;

  for (const category of categories) {
    const progress = progresses.find((p) => p.categoryId === category.id);
    const score = progress?.progressPercent ?? 0;
    if (score < lowestScore) {
      lowestScore = score;
      target = category;
    }
  }

  return target;
}
