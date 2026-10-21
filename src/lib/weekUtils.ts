// サーバーの実行環境のタイムゾーン(ローカル開発ではJSTだが、Vercel等の本番環境では
// 通常UTC)に依存せず、常に日本時間(JST)基準で「週の開始日(月曜)」を計算する。
// (src/lib/dateUtils.tsのgetJstDayOfYear等と同じ考え方。TZ依存のDate.prototype.getDay()等を
// そのまま使うと、クライアント(ブラウザ=JST)とサーバー(Vercel=UTC)で異なる値になり、
// 「追加したWeekly ToDoが表示上消える」という実際に発生した不具合の原因になっていた。)
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

interface JstParts {
  year: number;
  month: number; // 0-indexed
  date: number;
  dayOfWeek: number; // 0=日曜
}

function toJstParts(date: Date): JstParts {
  const jst = new Date(date.getTime() + JST_OFFSET_MS);
  return {
    year: jst.getUTCFullYear(),
    month: jst.getUTCMonth(),
    date: jst.getUTCDate(),
    dayOfWeek: jst.getUTCDay(),
  };
}

// JSTの指定日時(年月日・時刻)を表す、実際のUTC時刻(Date)を作る。
function fromJstParts(year: number, month: number, date: number, hours = 0, minutes = 0, seconds = 0, ms = 0): Date {
  const pseudoUtcMs = Date.UTC(year, month, date, hours, minutes, seconds, ms);
  return new Date(pseudoUtcMs - JST_OFFSET_MS);
}

export function getStartOfWeek(date: Date): Date {
  const { year, month, date: d, dayOfWeek } = toJstParts(date);
  const diff = (dayOfWeek + 6) % 7; // 月曜始まり
  return fromJstParts(year, month, d - diff);
}

export function getWeekLabel(date: Date): string {
  const start = getStartOfWeek(date);
  const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);

  const format = (value: Date) => {
    const { month, date: d } = toJstParts(value);
    return `${month + 1}/${d}`;
  };
  return `${format(start)}〜${format(end)}`;
}
