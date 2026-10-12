"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";

interface MarketDataFormInitial {
  id?: string;
  roleTitle?: string;
  requiredSkills?: string;
  preferredSkills?: string;
  requiredTrackRecord?: string;
  compensationRange?: string;
  sourceUrl?: string;
  sourceLabel?: string;
  fetchedAt?: Date | string;
  confirmedAt?: Date | string;
  note?: string;
}

function toDateInputValue(date?: Date | string): string {
  if (!date) return new Date().toISOString().slice(0, 10);
  return new Date(date).toISOString().slice(0, 10);
}

export function MarketDataForm({ initial }: { initial?: MarketDataFormInitial }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [roleTitle, setRoleTitle] = useState(initial?.roleTitle ?? "");
  const [requiredSkills, setRequiredSkills] = useState(initial?.requiredSkills ?? "");
  const [preferredSkills, setPreferredSkills] = useState(initial?.preferredSkills ?? "");
  const [requiredTrackRecord, setRequiredTrackRecord] = useState(initial?.requiredTrackRecord ?? "");
  const [compensationRange, setCompensationRange] = useState(initial?.compensationRange ?? "");
  const [sourceUrl, setSourceUrl] = useState(initial?.sourceUrl ?? "");
  const [sourceLabel, setSourceLabel] = useState(initial?.sourceLabel ?? "");
  const [fetchedAt, setFetchedAt] = useState(toDateInputValue(initial?.fetchedAt));
  const [confirmedAt, setConfirmedAt] = useState(toDateInputValue(initial?.confirmedAt));
  const [note, setNote] = useState(initial?.note ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      roleTitle,
      requiredSkills,
      preferredSkills,
      requiredTrackRecord,
      compensationRange,
      sourceUrl,
      sourceLabel,
      fetchedAt,
      confirmedAt,
      note,
    };

    const url = initial?.id ? `/api/market-data/${initial.id}` : "/api/market-data";
    const method = initial?.id ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSubmitting(false);

    if (!res.ok) {
      setError("保存に失敗しました。入力内容を確認してください。");
      return;
    }

    router.push("/market-value/market-data");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        実際に求人・案件情報を確認できた内容のみを登録してください。推測やAIによる補完は行いません。
      </p>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">対象職種・案件</label>
        <Input required value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">必須スキル・経験(カンマ区切り)</label>
        <Textarea rows={2} value={requiredSkills} onChange={(e) => setRequiredSkills(e.target.value)} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">歓迎スキル(カンマ区切り)</label>
        <Textarea rows={2} value={preferredSkills} onChange={(e) => setPreferredSkills(e.target.value)} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">求められる実績・ポートフォリオ</label>
        <Textarea rows={2} value={requiredTrackRecord} onChange={(e) => setRequiredTrackRecord(e.target.value)} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">報酬水準(任意)</label>
        <Input value={compensationRange} onChange={(e) => setCompensationRange(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">情報源(サイト名等)</label>
          <Input value={sourceLabel} onChange={(e) => setSourceLabel(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">参照URL(任意)</label>
          <Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">取得日</label>
          <Input type="date" value={fetchedAt} onChange={(e) => setFetchedAt(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">確認日(最後に見直した日)</label>
          <Input type="date" value={confirmedAt} onChange={(e) => setConfirmedAt(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">メモ(任意)</label>
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "保存中..." : "保存する"}
        </Button>
      </div>
    </form>
  );
}
