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

// 1970-01-01からの「JST基準の経過日数」。年をまたいでも連続して増え続けるため、
// 年初に巡回がリセットされない(getJstDayOfYearは年初で0に戻ってしまう)。
export function getJstEpochDay(date: Date): number {
  return Math.floor((date.getTime() + JST_OFFSET_MS) / (1000 * 60 * 60 * 24));
}

// 決定的な疑似乱数生成器(mulberry32)。Math.random()は再現性が無く、サーバー再起動
// やリクエストごとに結果が変わってしまうため使わない。
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(s: string): number {
  let h = 2166136261; // FNV-1aの初期値
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffledIndices(length: number, seed: number): number[] {
  const rand = mulberry32(seed);
  const arr = Array.from({ length }, (_, i) => i);
  for (let i = length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// リスト内の全件(listLength件)を表示し終えるまでの1周回の中では、絶対に同じ項目を
// 重複して出さない(シャッフルした順で1件ずつ消費する)。周回が変わるとシャッフル順も
// 変わるため、単純な「日数 % 件数」のような固定巡回パターンにもならない。
// ただし、リストの件数は有限なので、1周回(listLength日)を超えて続けた場合、
// 技術的に過去に表示した項目が再登場すること自体は避けられない
// (例: 本が3冊しかない場合、4日目以降は必ずどれかの再登場になる)。
export function getNoRepeatDailyIndex(date: Date, listLength: number, salt: string): number {
  if (listLength <= 0) return 0;
  const epochDay = getJstEpochDay(date);
  const cycle = Math.floor(epochDay / listLength);
  const position = epochDay % listLength;
  const seed = (hashSeed(salt) ^ cycle) >>> 0;
  return shuffledIndices(listLength, seed)[position];
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
