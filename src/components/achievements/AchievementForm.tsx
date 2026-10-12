"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { AxisPicker } from "./AxisPicker";
import { ACHIEVEMENT_DRAFT_STORAGE_KEY } from "@/components/diary/ExtractAchievementButton";

interface AchievementDraft {
  title: string;
  challenge: string;
  action: string;
  result: string;
  metricValue: string;
  skillsUsed: string;
  missingEvidenceHint?: string[];
  categoryId: string;
  date: string;
  sourceDiaryEntryId: string;
}

interface CategoryOption {
  id: string;
  label: string;
}

interface LinkOption {
  id: string;
  title: string;
}

type RevenueType = "SALES" | "COMPENSATION" | "PROFIT" | "OTHER";

const REVENUE_TYPE_LABEL: Record<RevenueType, string> = {
  SALES: "売上",
  COMPENSATION: "報酬",
  PROFIT: "利益",
  OTHER: "その他",
};

interface AchievementFormInitial {
  id?: string;
  title?: string;
  challenge?: string;
  action?: string;
  result?: string;
  metricValue?: string | null;
  skillsUsed?: string;
  role?: string;
  thirdPartyFeedback?: string;
  revenueAmount?: number | null;
  revenueCurrency?: string;
  revenueType?: RevenueType;
  revenuePeriod?: string;
  evidenceUrl?: string | null;
  evidenceNote?: string | null;
  date?: Date | string;
  categoryId?: string;
  axisLinks?: { axisKey: string }[];
  relatedIndividualGoalId?: string | null;
}

function toDateInputValue(date?: Date | string): string {
  if (!date) return new Date().toISOString().slice(0, 10);
  return new Date(date).toISOString().slice(0, 10);
}

export function AchievementForm({
  categories,
  initial,
  individualGoals = [],
}: {
  categories: CategoryOption[];
  initial?: AchievementFormInitial;
  individualGoals?: LinkOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromDraft, setFromDraft] = useState(false);
  const [draftMissingEvidenceHint, setDraftMissingEvidenceHint] = useState<string[]>([]);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [challenge, setChallenge] = useState(initial?.challenge ?? "");
  const [action, setAction] = useState(initial?.action ?? "");
  const [result, setResult] = useState(initial?.result ?? "");
  const [metricValue, setMetricValue] = useState(initial?.metricValue ?? "");
  const [skillsUsed, setSkillsUsed] = useState(initial?.skillsUsed ?? "");
  const [role, setRole] = useState(initial?.role ?? "");
  const [thirdPartyFeedback, setThirdPartyFeedback] = useState(initial?.thirdPartyFeedback ?? "");
  // 収益額は「未入力」と「0円」を区別するため、入力欄は空文字(未入力)と"0"(発生なし)を別の状態として扱う。
  const [revenueAmount, setRevenueAmount] = useState(
    initial?.revenueAmount !== undefined && initial?.revenueAmount !== null ? String(initial.revenueAmount) : ""
  );
  const [revenueCurrency, setRevenueCurrency] = useState(initial?.revenueCurrency ?? "JPY");
  const [revenueType, setRevenueType] = useState<RevenueType>(initial?.revenueType ?? "SALES");
  const [revenuePeriod, setRevenuePeriod] = useState(initial?.revenuePeriod ?? "");
  const [evidenceUrl, setEvidenceUrl] = useState(initial?.evidenceUrl ?? "");
  const [evidenceNote, setEvidenceNote] = useState(initial?.evidenceNote ?? "");
  const [date, setDate] = useState(toDateInputValue(initial?.date));
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? categories[0]?.id ?? "");
  const [axisKeys, setAxisKeys] = useState<string[]>(
    initial?.axisLinks?.map((l) => l.axisKey) ?? []
  );
  const [relatedIndividualGoalId, setRelatedIndividualGoalId] = useState(initial?.relatedIndividualGoalId ?? "");
  const [sourceDiaryEntryId, setSourceDiaryEntryId] = useState<string | null>(null);

  // 日記から「実績候補を抽出する」で遷移してきた場合、sessionStorageに置かれた下書きをフォームへ反映する。
  // 保存ボタンを押すまでDBには何も保存しない(未確認情報が実績として加点されるのを防ぐ)。
  useEffect(() => {
    if (initial?.id) return; // 編集時は対象外
    if (searchParams.get("fromDraft") !== "1") return;

    const raw = sessionStorage.getItem(ACHIEVEMENT_DRAFT_STORAGE_KEY);
    if (!raw) return;
    sessionStorage.removeItem(ACHIEVEMENT_DRAFT_STORAGE_KEY);

    try {
      const draft: AchievementDraft = JSON.parse(raw);
      if (draft.title) setTitle(draft.title);
      if (draft.challenge) setChallenge(draft.challenge);
      if (draft.action) setAction(draft.action);
      if (draft.result) setResult(draft.result);
      if (draft.metricValue) setMetricValue(draft.metricValue);
      if (draft.skillsUsed) setSkillsUsed(draft.skillsUsed);
      if (draft.categoryId) setCategoryId(draft.categoryId);
      if (draft.date) setDate(toDateInputValue(draft.date));
      if (draft.sourceDiaryEntryId) setSourceDiaryEntryId(draft.sourceDiaryEntryId);
      if (draft.missingEvidenceHint) setDraftMissingEvidenceHint(draft.missingEvidenceHint);
      setFromDraft(true);
    } catch {
      // 下書きが壊れていた場合は無視し、空のフォームのまま使ってもらう
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      title,
      challenge,
      action,
      result,
      metricValue,
      skillsUsed,
      role,
      thirdPartyFeedback,
      revenueAmount: revenueAmount.trim() === "" ? null : Number(revenueAmount),
      revenueCurrency,
      revenueType,
      revenuePeriod,
      evidenceUrl,
      evidenceNote,
      date,
      categoryId,
      axisKeys,
      relatedIndividualGoalId: relatedIndividualGoalId || null,
      ...(sourceDiaryEntryId ? { sourceDiaryEntryId } : {}),
    };

    const url = initial?.id ? `/api/achievements/${initial.id}` : "/api/achievements";
    const method = initial?.id ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(
        typeof body?.error === "string" ? body.error : "保存に失敗しました。入力内容を確認してください。",
      );
      return;
    }

    router.push("/achievements");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {fromDraft && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <p>日記からAIが抽出した下書きです。内容を確認・修正してから保存してください。</p>
          {draftMissingEvidenceHint.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-xs text-emerald-700">
              {draftMissingEvidenceHint.map((hint, i) => (
                <li key={i}>{hint}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">何をしたか</label>
        <Input required value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">日付</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">カテゴリー</label>
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">行動</label>
        <Textarea required rows={2} value={action} onChange={(e) => setAction(e.target.value)} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">結果</label>
        <Textarea required rows={2} value={result} onChange={(e) => setResult(e.target.value)} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">使用したスキル(カンマ区切り、複数可)</label>
        <Input required value={skillsUsed} onChange={(e) => setSkillsUsed(e.target.value)} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">課題(任意)</label>
        <Textarea rows={2} value={challenge} onChange={(e) => setChallenge(e.target.value)} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          数値(任意・金額以外。例: 「作業時間を30%削減」。収益額は下の「収益」欄に入力してください)
        </label>
        <Input value={metricValue} onChange={(e) => setMetricValue(e.target.value)} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">自分が担当した範囲(任意)</label>
        <Textarea rows={2} value={role} onChange={(e) => setRole(e.target.value)} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          第三者評価(任意。上司・顧客など自分以外からの評価コメント)
        </label>
        <Textarea
          rows={2}
          placeholder="未記入だと第三者評価軸には加点されません。"
          value={thirdPartyFeedback}
          onChange={(e) => setThirdPartyFeedback(e.target.value)}
        />
      </div>

      <div className="rounded-xl border border-slate-200 p-3">
        <div className="mb-2 text-sm font-medium text-slate-700">収益(任意)</div>
        <p className="mb-2 text-xs text-slate-500">
          実際に発生した金額のみを入力してください(見込み・推定額は入力しない)。未入力と「0円」は区別して記録されます。
        </p>
        <div className="grid grid-cols-3 gap-2">
          <Input
            type="number"
            placeholder="金額(未入力可)"
            value={revenueAmount}
            onChange={(e) => setRevenueAmount(e.target.value)}
          />
          <Select value={revenueCurrency} onChange={(e) => setRevenueCurrency(e.target.value)}>
            <option value="JPY">円</option>
            <option value="USD">ドル</option>
          </Select>
          <Select value={revenueType} onChange={(e) => setRevenueType(e.target.value as RevenueType)}>
            {(Object.keys(REVENUE_TYPE_LABEL) as RevenueType[]).map((k) => (
              <option key={k} value={k}>
                {REVENUE_TYPE_LABEL[k]}
              </option>
            ))}
          </Select>
        </div>
        <Input
          className="mt-2"
          placeholder="対象期間(任意。例: 2026年10月)"
          value={revenuePeriod}
          onChange={(e) => setRevenuePeriod(e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">証拠URL(任意)</label>
        <Input value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">証拠メモ(任意)</label>
        <Textarea rows={2} value={evidenceNote} onChange={(e) => setEvidenceNote(e.target.value)} />
      </div>

      {individualGoals.length > 0 && (
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">関連する個別目標(任意)</label>
          <Select value={relatedIndividualGoalId} onChange={(e) => setRelatedIndividualGoalId(e.target.value)}>
            <option value="">(選択しない)</option>
            {individualGoals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">
          関連する市場価値の軸(複数選択可・任意)
        </label>
        <p className="mb-2 text-xs text-slate-500">
          「再現性」は、同じ手法を別の場面でも再現できた場合にタグ付けしてください(これが再現性の唯一の判定基準です)。
        </p>
        <AxisPicker selected={axisKeys} onChange={setAxisKeys} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "保存中..." : "保存する"}
        </Button>
      </div>
    </form>
  );
}
