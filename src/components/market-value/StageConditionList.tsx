export function StageConditionList({
  nextStageTitle,
  conditions,
}: {
  nextStageTitle: string | null;
  conditions: { label: string; achieved: boolean }[];
}) {
  if (!nextStageTitle) {
    return (
      <p className="text-sm text-slate-600">
        現在のロジックで定義されている最高ステージに到達しています。
      </p>
    );
  }

  const allAchieved = conditions.every((c) => c.achieved);

  return (
    <div>
      <p className="mb-3 text-sm text-slate-600">
        次のステージ「{nextStageTitle}」に進むための条件:
      </p>
      <ul className="flex flex-col gap-2">
        {conditions.map((c, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-xs text-white ${
                c.achieved ? "bg-green-600" : "bg-slate-300"
              }`}
            >
              {c.achieved ? "✓" : ""}
            </span>
            <span className={c.achieved ? "text-slate-700" : "text-slate-500"}>{c.label}</span>
          </li>
        ))}
      </ul>
      {!allAchieved && (
        <p className="mt-3 text-sm font-medium text-amber-700">
          まだ証拠が足りません。すべての条件を満たすまでステージは上がりません。
        </p>
      )}
    </div>
  );
}
