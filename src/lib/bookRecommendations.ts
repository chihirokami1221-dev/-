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
    {
      title: "コトラーのマーケティング入門(原書14版)",
      author: "フィリップ・コトラー、ゲイリー・アームストロング",
      reason: "「近代マーケティングの父」コトラーによる定番の入門書。",
    },
    {
      title: "シュガーマンのマーケティング30の法則",
      author: "ジョセフ・シュガーマン",
      reason: "消費者心理や購買行動を実例から解説する、接客・販売にも応用できる一冊。",
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
    {
      title: "ゼロ・トゥ・ワン",
      author: "ピーター・ティール",
      reason: "「競争ではなく独占を目指す」という、新しい事業を生み出す考え方を学べる一冊。",
    },
    {
      title: "もし高校野球の女子マネージャーがドラッカーの『マネジメント』を読んだら",
      author: "岩崎夏海",
      reason: "ドラッカーの経営理論を物語形式でわかりやすく学べる、副業・小規模事業にも使える入門書。",
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
    {
      title: "西洋音楽史",
      author: "岡田暁生",
      reason: "クラシック音楽の歴史を一冊で見通せる定番の新書。",
    },
    {
      title: "「医師」と「声楽家」が解き明かす 発声のメカニズム",
      author: "萩野仁志、後野仁彦",
      reason: "医学と声楽の両方の視点から、発声の仕組みを解説したベストセラー。",
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
