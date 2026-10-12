"use client";

// カンマ・読点・スラッシュ・中点区切りのスキル文字列を配列にする(表示用、大文字小文字は保持)。
function splitPreservingCase(raw: string): string[] {
  return raw
    .split(/[,、,/・\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// 候補スキルをクリックで追加/削除できるチップ一覧。自由入力の手間を減らし、
// 同じ表記を使い回してもらうことで市場需要軸の照合精度も上げる。
export function SkillChips({
  suggestions,
  value,
  onChange,
  max = 20,
}: {
  suggestions: string[];
  value: string;
  onChange: (next: string) => void;
  max?: number;
}) {
  if (suggestions.length === 0) return null;

  const current = splitPreservingCase(value);

  function toggle(skill: string) {
    const exists = current.some((c) => c.toLowerCase() === skill.toLowerCase());
    const next = exists
      ? current.filter((c) => c.toLowerCase() !== skill.toLowerCase())
      : [...current, skill];
    onChange(next.join(","));
  }

  return (
    <div className="mt-1.5">
      <div className="mb-1 text-xs text-slate-400">よく使うスキル(クリックで追加/削除)</div>
      <div className="flex flex-wrap gap-1">
        {suggestions.slice(0, max).map((s) => {
          const active = current.some((c) => c.toLowerCase() === s.toLowerCase());
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggle(s)}
              className={`rounded-full px-2 py-0.5 text-xs transition-colors ${
                active
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {s}
            </button>
          );
        })}
      </div>
    </div>
  );
}
