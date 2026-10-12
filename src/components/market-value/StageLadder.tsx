import { STAGE_DEFINITIONS } from "@/lib/marketValue/stages";

export function StageLadder({ currentLevel }: { currentLevel: number }) {
  return (
    <div className="flex flex-col gap-2">
      {STAGE_DEFINITIONS.slice()
        .reverse()
        .map((stage) => {
          const reached = stage.level <= currentLevel;
          const isCurrent = stage.level === currentLevel;
          return (
            <div
              key={stage.level}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                isCurrent
                  ? "border-slate-900 bg-slate-900 text-white"
                  : reached
                  ? "border-slate-300 bg-slate-100 text-slate-700"
                  : "border-slate-100 bg-white text-slate-400"
              }`}
            >
              <span className="w-16 shrink-0 text-sm font-bold">LEVEL {stage.level}</span>
              <span className="text-sm">{stage.title}</span>
              <span className={`text-xs ${isCurrent ? "text-slate-300" : "text-slate-400"}`}>
                スコア{stage.minScore}以上{stage.conditions.length > 0 ? `・条件${stage.conditions.length}件` : ""}
              </span>
              {isCurrent && <span className="ml-auto text-xs">現在地</span>}
            </div>
          );
        })}
    </div>
  );
}
