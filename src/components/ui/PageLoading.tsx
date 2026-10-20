// ページ遷移中(サーバーでのデータ取得待ち)に即座に表示する軽量スケルトン。
// データそのものはキャッシュしない(Next.jsのloading.tsx機構は新しいデータ取得の
// 「結果が届くまでの見た目」だけを担い、取得自体は常に最新データへのリクエストのまま)。
export function PageLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="読み込み中">
      <div className="h-7 w-40 animate-pulse rounded-lg bg-slate-200" />
      <div className="h-32 animate-pulse rounded-3xl bg-slate-100" />
      <div className="h-32 animate-pulse rounded-3xl bg-slate-100" />
    </div>
  );
}
