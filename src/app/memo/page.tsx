import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatJP } from "@/lib/dateUtils";

export default async function MemoListPage() {
  await connection();
  const memos = await prisma.memo.findMany({ orderBy: { updatedAt: "desc" } });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">メモ</h1>
        <Link href="/memo/new">
          <Button>+ 新規メモ</Button>
        </Link>
      </div>

      {memos.length === 0 ? (
        <EmptyState message="まだメモがありません。" />
      ) : (
        <ul className="flex flex-col gap-2">
          {memos.map((memo) => (
            <li key={memo.id}>
              <Link
                href={`/memo/${memo.id}`}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 transition-shadow hover:shadow-md"
              >
                <span className="font-medium text-slate-900">{memo.title}</span>
                <span className="text-xs text-slate-400">{formatJP(memo.updatedAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
