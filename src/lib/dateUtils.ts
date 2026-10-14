export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

// サーバーの実行環境のタイムゾーン(ローカル開発ではJSTだが、Vercel等の本番環境では
// 通常UTC)に依存せず、常に日本時間(JST)の「その日」を基準に年初からの日数を返す。
// 「今日の本・今日の英単語・今日の哲学者の一言」等、日付が変わったら切り替わる表示の
// 判定に使う(サーバーのTZによって切り替わる瞬間がズレないようにするため)。
export function getJstDayOfYear(date: Date): number {
  const jst = new Date(date.getTime() + JST_OFFSET_MS);
  const startOfYearJst = new Date(Date.UTC(jst.getUTCFullYear(), 0, 1));
  const diff = jst.getTime() - startOfYearJst.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function formatJP(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day + 6) % 7; // 月曜始まり
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfWeek(date: Date): Date {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function daysUntil(date: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
