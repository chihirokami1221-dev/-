"use client";

import { ACHIEVEMENT_TAGGABLE_AXES } from "@/lib/marketValue/axes";

export function AxisPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(key: string) {
    if (selected.includes(key)) {
      onChange(selected.filter((k) => k !== key));
    } else {
      onChange([...selected, key]);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {ACHIEVEMENT_TAGGABLE_AXES.map((axis) => (
        <label
          key={axis.key}
          className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <input
            type="checkbox"
            checked={selected.includes(axis.key)}
            onChange={() => toggle(axis.key)}
          />
          {axis.label}
        </label>
      ))}
    </div>
  );
}
