"use client";

import { useState } from "react";

interface ParsedEntry {
  date: string;
  headline: string;
  details: string | null;
}

// dailyArchive.tsが保存する形式専用の表示。
// エントリ同士は"\n===\n"で区切り(新しい日付が先頭)、各エントリは1行目=日付、2行目以降=見出し、"---"より後ろ=詳細。
function parseEntries(content: string): ParsedEntry[] {
  return content.split("\n===\n").map((block) => {
    const [head, details] = block.split("\n---\n");
    const headLines = (head ?? "").split("\n");
    return {
      date: headLines[0] ?? "",
      headline: headLines.slice(1).join("\n"),
      details: details ?? null,
    };
  });
}

function EntryBody({ entry, defaultOpen }: { entry: ParsedEntry; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      {entry.date && <p className="mb-2 text-xs text-slate-400">{entry.date}</p>}
      <p className="whitespace-pre-wrap text-lg font-bold text-slate-900">{entry.headline}</p>

      {entry.details && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
          >
            {open ? "詳細を閉じる ▲" : "詳細を見る ▼"}
          </button>
          {open && (
            <p className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              {entry.details}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function ArchivedMemoDetail({ content }: { content: string }) {
  const [showHistory, setShowHistory] = useState(false);
  const entries = parseEntries(content);
  const [latest, ...past] = entries;

  return (
    <div>
      {latest && <EntryBody entry={latest} defaultOpen={false} />}

      {past.length > 0 && (
        <div className="mt-6 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            {showHistory ? `過去の記録を閉じる ▲` : `過去の記録を見る(${past.length}件) ▼`}
          </button>
          {showHistory && (
            <div className="mt-4 flex flex-col gap-4">
              {past.map((entry, i) => (
                <div key={i} className="border-t border-slate-50 pt-4 first:border-t-0 first:pt-0">
                  <EntryBody entry={entry} defaultOpen={false} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
