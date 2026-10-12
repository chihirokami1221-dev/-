"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export const ACHIEVEMENT_DRAFT_STORAGE_KEY = "growth-os:achievement-draft";

export function ExtractAchievementButton({ diaryEntryId }: { diaryEntryId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/diary/${diaryEntryId}/extract-achievement`, { method: "POST" });
    const data = await res.json();

    if (!res.ok) {
      setError(data?.error ?? "抽出に失敗しました。");
      setLoading(false);
      return;
    }

    const { draft, categoryId, date, sourceDiaryEntryId, existingAchievementTitles } = data;
    if (!draft.title && !draft.action && !draft.result) {
      setError("この日記からは実績候補を見つけられませんでした。内容を確認のうえ手動で登録してください。");
      setLoading(false);
      return;
    }

    if (existingAchievementTitles?.length > 0) {
      const proceed = window.confirm(
        `この日記からは既に実績が登録されています(${existingAchievementTitles.join("、")})。\n続けて新しい候補を確認しますか?(重複登録に注意してください)`,
      );
      if (!proceed) {
        setLoading(false);
        return;
      }
    }

    sessionStorage.setItem(
      ACHIEVEMENT_DRAFT_STORAGE_KEY,
      JSON.stringify({ ...draft, categoryId, date, sourceDiaryEntryId }),
    );
    router.push("/achievements/new?fromDraft=1");
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" onClick={handleClick} disabled={loading}>
        {loading ? "抽出中...(数十秒かかります)" : "この日記から実績候補を抽出する"}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
