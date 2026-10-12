"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function RecalculateButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    await fetch("/api/market-value/score", { method: "POST" });
    setLoading(false);
    router.refresh();
  }

  return (
    <Button variant="secondary" onClick={handleClick} disabled={loading}>
      {loading ? "更新中..." : "現在のスコアを記録する"}
    </Button>
  );
}
