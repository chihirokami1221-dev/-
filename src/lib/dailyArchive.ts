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

async function upsertDailyEntry(sourceKey: string, title: string, todayEntry: string, ymd: string) {
  const existing = await prisma.memo.findUnique({ where: { sourceKey } });

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
export async function ensureTodayArchived(categories: Category[], progresses: Progress[], date: Date = new Date()): Promise<void> {
  const ymd = dateKey(date);

  // エントリ形式: 1行目=日付、2行目=見出し(単語/本の題名/名言そのもの)、"---"区切りの後に詳細説明。
  // メモ詳細画面では見出しまでを先に表示し、タップすると"---"より後ろの詳細が開く(src/components/memo/ArchivedMemoDetail.tsx)。
  const quote = getTodayQuote(date);
  await upsertDailyEntry(
    "quote",
    "今日の哲学者の一言",
    `${ymd}\n${quote.text}\n---\n意味: ${quote.meaning}\n\n— ${quote.author}`,
    ymd,
  );

  const word = getTodayWord(date);
  await upsertDailyEntry(
    "word",
    "今日の英単語",
    `${ymd}\n${word.word}\n---\n${word.meaning}\n\n例文: ${word.example}\n${word.exampleJa}`,
    ymd,
  );

  const targetCategory = pickCategoryForBook(categories, progresses);
  const book = targetCategory ? getTodayBook(targetCategory.key, date) : null;
  if (targetCategory && book) {
    await upsertDailyEntry(
      "book",
      "今日のおすすめの本",
      `${ymd}\n${book.title}\n---\n著者: ${book.author}\n\n${book.reason}\n\n対象領域: ${targetCategory.label}`,
      ymd,
    );
  }
}
