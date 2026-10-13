"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "ダッシュボード" },
  { href: "/diary", label: "日記" },
  { href: "/roadmap", label: "ロードマップ" },
  { href: "/goals", label: "個別目標" },
  { href: "/achievements", label: "実績データベース" },
  { href: "/memo", label: "メモ" },
  { href: "/market-value", label: "市場価値ステージ" },
  { href: "/market-value/axes", label: "市場価値5軸" },
  { href: "/market-value/market-data", label: "市場データ" },
  { href: "/chat", label: "AIチャット" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-slate-200 bg-white px-3 py-3 md:h-full md:w-56 md:border-b-0 md:border-r md:px-4 md:py-6">
      <div className="mb-2 px-2 text-lg font-bold text-slate-900 md:mb-6">成長OS</div>
      <nav className="flex gap-1 overflow-x-auto pb-1 md:flex-col md:overflow-x-visible md:pb-0">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={handleLogout}
          className="shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        >
          ログアウト
        </button>
      </nav>
    </aside>
  );
}
