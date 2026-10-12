"use client";

import Link from "next/link";
import { RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";

export function ProgressRingChart({
  value,
  color,
  label,
  categoryId,
}: {
  value: number | null;
  color: string;
  label: string;
  categoryId?: string;
}) {
  const displayValue = value ?? 0;
  const data = [{ name: label, value: displayValue, fill: color }];

  const content = (
    <div className="flex flex-col items-center">
      <div className="relative rounded-full bg-gradient-to-br from-emerald-50 via-lime-50 to-amber-50 p-2 shadow-[0_10px_30px_rgba(22,163,74,0.10)]" style={{ width: 140, height: 140 }}>
        <div className="absolute inset-2 rounded-full bg-white/70" />
        <div className="relative" style={{ width: 124, height: 124 }}>
          <RadialBarChart
            width={124}
            height={124}
            cx="50%"
            cy="50%"
            innerRadius="72%"
            outerRadius="100%"
            barSize={12}
            data={data}
            startAngle={90}
            endAngle={-270}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar background={{ fill: "#e2e8f0" }} dataKey="value" cornerRadius={8} />
          </RadialBarChart>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {value === null ? (
              <span className="text-[10px] font-semibold tracking-wide text-slate-400">目標未設定</span>
            ) : (
              <span className="text-2xl font-black text-emerald-700">{value}%</span>
            )}
          </div>
        </div>
      </div>
      <div className="mt-3 text-center text-sm font-semibold text-slate-700">{label}</div>
    </div>
  );

  if (!categoryId) return content;

  return (
    <Link href="/goals" className="transition-opacity hover:opacity-80" title={`${label}の個別目標を見る`}>
      {content}
    </Link>
  );
}
