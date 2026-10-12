"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const REFRESH_INTERVAL_MS = 10000;
// focus/visibilitychangeが短時間に連続発火しても、router.refresh()を連打しないための最小間隔。
const MIN_REFRESH_GAP_MS = 5000;

export function AutoSync() {
  const router = useRouter();
  const lastRefreshAt = useRef(0);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRefreshAt.current < MIN_REFRESH_GAP_MS) return; // 連続発火をガード
      lastRefreshAt.current = now;
      router.refresh();
    };

    const interval = window.setInterval(refreshWhenVisible, REFRESH_INTERVAL_MS);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [router]);

  return null;
}
