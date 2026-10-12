// 計画ブロックの「期間」を日付レンジではなく「何月か」で選べるようにするための月プルダウン用ユーティリティ。
export interface MonthOption {
  value: string; // "YYYY-MM"
  label: string; // "2026年5月"
}

// 直近6か月前〜36か月先までを選択肢にする(長期ロードマップでも足りる範囲)。
export function generateMonthOptions(base: Date = new Date(), before = 6, after = 36): MonthOption[] {
  const options: MonthOption[] = [];
  const y = base.getFullYear();
  const m = base.getMonth();

  for (let i = -before; i <= after; i++) {
    const d = new Date(y, m + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    options.push({ value, label: `${d.getFullYear()}年${d.getMonth() + 1}月` });
  }

  return options;
}

export function monthToDateRange(ym: string): { startDate: string; dueDate: string } {
  const [y, m] = ym.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0); // 翌月0日 = 当月末日
  return { startDate: toDateOnly(start), dueDate: toDateOnly(end) };
}

// "YYYY-MM" を対象月の正規化形式(月初0時・ローカルタイム)のDateに変換する。
// IndividualGoal.targetMonthの保存形式(src/lib/keyActionSync.tsのmonthStartと同じ正規化)に合わせる。
export function monthValueToDate(ym: string): Date {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1, 0, 0, 0, 0);
}

// 指定した日付が属する月の1日0時(ローカルタイム)を返す。IndividualGoal.targetMonthの正規化キーとして使う
// (src/lib/keyActionSync.tsのmonthStartと同じ正規化)。
export function monthStartOfDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

export function dateToMonthValue(date: string | Date | null): string {
  if (!date) return "";
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function toDateOnly(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// startDate〜dueDateがちょうど1か月分(月初〜月末)なら「2026年5月」、そうでなければ元の日付表示にフォールバックする
// (月プルダウン導入前に日付レンジで登録された既存データも壊さず表示するため)。
export function formatPhasePeriod(
  startDate: string | Date | null,
  dueDate: string | Date | null,
  formatJP: (d: Date) => string,
): string {
  if (!startDate && !dueDate) return "時期未設定";
  if (startDate && dueDate) {
    const s = new Date(startDate);
    const e = new Date(dueDate);
    const isFullMonth =
      s.getDate() === 1 &&
      s.getFullYear() === e.getFullYear() &&
      s.getMonth() === e.getMonth() &&
      e.getDate() === new Date(e.getFullYear(), e.getMonth() + 1, 0).getDate();
    if (isFullMonth) return `${s.getFullYear()}年${s.getMonth() + 1}月`;
  }
  const startLabel = startDate ? formatJP(new Date(startDate)) : "開始日未設定";
  const dueLabel = dueDate ? formatJP(new Date(dueDate)) : "終了日未設定";
  return `${startLabel} 〜 ${dueLabel}`;
}
