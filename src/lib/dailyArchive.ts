import { prisma } from "@/lib/prisma";
import { getTodayQuote } from "@/lib/philosopherQuotes";
import { getTodayWord } from "@/lib/dailyEnglishWords";
import { getTodayBook, pickCategoryForBook } from "@/lib/bookRecommendations";

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

interface Category {
  id: string;
  key: string;
  label: string;
}

interface Progress {
  categoryId: string;
  progressPercent: number | null;
}

// 1件のエントリの先頭行は必ず日付(YYYY-MM-DD)。履歴は新しい日付が先頭、エントリ同士は"\n===\n"で区切る。
const ENTRY_SEPARATOR = "\n===\n";

interface ExistingMemo {
  sourceKey: string | null;
  content: string;
}

// 事前にまとめて取得した既存メモ(1件のfindManyの結果)を使って、1種類分の
// create/update判定だけを行う(この関数自体はDB読み取りを行わない)。
async function upsertDailyEntry(
  sourceKey: string,
  title: string,
  todayEntry: string,
  ymd: string,
  existing: ExistingMemo | undefined,
) {
  if (!existing) {
    await prisma.memo.create({ data: { sourceKey, title, content: todayEntry } });
    return;
  }

  const firstLine = existing.content.split("\n", 1)[0];
  if (firstLine === ymd) return; // 今日の分は既に記録済み

  await prisma.memo.update({
    where: { sourceKey },
    data: { content: `${todayEntry}${ENTRY_SEPARATOR}${existing.content}` },
  });
}

// 今日の哲学者の一言・英単語・おすすめ本を、種類ごとに1件のメモへ日々追記していく(sourceKeyは種類固定、日付では分けない)。
//
// パフォーマンス上の注意: この処理はダッシュボード表示のたびに毎回呼ばれるが、ほとんどの場合
// 「今日の分はすでに記録済みで何もしない」で終わる。そのため、種類ごとに個別にfindUniqueする
// (最大3回の往復)のではなく、対象のsourceKeyを1回のfindManyでまとめて取得し、
// 書き込みが必要なものだけをPromise.allで並列実行する(往復回数を減らす)。
export async function ensureTodayArchived(categories: Category[], progresses: Progress[], date: Date = new Date()): Promise<void> {
  const ymd = dateKey(date);

  // エントリ形式: 1行目=日付、2行目=見出し(単語/本の題名/名言そのもの)、"---"区切りの後に詳細説明。
  // メモ詳細画面では見出しまでを先に表示し、タップすると"---"より後ろの詳細が開く(src/components/memo/ArchivedMemoDetail.tsx)。
  const quote = getTodayQuote(date);
  const word = getTodayWord(date);
  const targetCategory = pickCategoryForBook(categories, progresses);
  const book = targetCategory ? getTodayBook(targetCategory.key, date) : null;

  const sourceKeys = targetCategory && book ? ["quote", "word", "book"] : ["quote", "word"];
  const existingEntries = await prisma.memo.findMany({
    where: { sourceKey: { in: sourceKeys } },
    select: { sourceKey: true, content: true },
  });
  const existingByKey = new Map(existingEntries.map((m) => [m.sourceKey, m]));

  const tasks = [
    upsertDailyEntry(
      "quote",
      "今日の哲学者の一言",
      `${ymd}\n${quote.text}\n---\n意味: ${quote.meaning}\n\n— ${quote.author}`,
      ymd,
      existingByKey.get("quote"),
    ),
    upsertDailyEntry(
      "word",
      "今日の英単語",
      `${ymd}\n${word.word}\n---\n${word.meaning}\n\n例文: ${word.example}\n${word.exampleJa}`,
      ymd,
      existingByKey.get("word"),
    ),
  ];

  if (targetCategory && book) {
    tasks.push(
      upsertDailyEntry(
        "book",
        "今日のおすすめの本",
        `${ymd}\n${book.title}\n---\n著者: ${book.author}\n\n${book.reason}\n\n対象領域: ${targetCategory.label}`,
        ymd,
        existingByKey.get("book"),
      ),
    );
  }

  await Promise.all(tasks);
}
