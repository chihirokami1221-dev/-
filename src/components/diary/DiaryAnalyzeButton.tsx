"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function DiaryAnalyzeButton({ entryId }: { entryId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/diary/${entryId}/analyze`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "分析に失敗しました。");
    } else {
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" onClick={handleClick} disabled={loading}>
        {loading ? "分析中..." : "AIに分析してもらう"}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
