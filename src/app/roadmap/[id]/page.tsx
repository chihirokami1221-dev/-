import { redirect } from "next/navigation";

// 計画ブロックの作成・編集・削除はすべて /roadmap 画面に集約したため、
// 個別のURL(他画面からのリンク・ブックマーク等)は該当カードへアンカー遷移させる。
export default async function RoadmapDetailRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/roadmap#${id}`);
}
