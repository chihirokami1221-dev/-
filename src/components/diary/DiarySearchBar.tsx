"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CategoryOption {
  id: string;
  label: string;
}

export function DiarySearchBar({
  categories,
  defaultKeyword,
  defaultCategoryId,
}: {
  categories: CategoryOption[];
  defaultKeyword?: string;
  defaultCategoryId?: string;
}) {
  const router = useRouter();
  const [keyword, setKeyword] = useState(defaultKeyword ?? "");
  const [categoryId, setCategoryId] = useState(defaultCategoryId ?? "");

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (keyword) params.set("keyword", keyword);
    if (categoryId) params.set("categoryId", categoryId);
    router.push(`/diary?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSearch} className="flex gap-2">
      <Input
        placeholder="キーワード検索"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
      />
      <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-40">
        <option value="">すべてのカテゴリー</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </Select>
      <Button type="submit" variant="secondary">
        検索
      </Button>
    </form>
  );
}
