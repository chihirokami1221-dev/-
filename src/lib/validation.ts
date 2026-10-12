import { z } from "zod";

// ロードマップの登録フォームはタイトル・カテゴリ(分野)・期間のみ。
// content/completionCriteria/reason/requiredSkillsは過去バージョンの名残で、詳細は重点行動タブで管理する。
export const roadmapItemSchema = z.object({
  title: z.string().min(1),
  content: z.string().default(""),
  categoryId: z.string().min(1),
  startDate: z.coerce.date().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
  completionCriteria: z.string().default(""),
  reason: z.string().default(""),
  requiredSkills: z.string().default(""),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "ON_HOLD", "DONE"]).default("NOT_STARTED"),
  progressPercent: z.coerce.number().min(0).max(100).default(0),
});

// .partial()はdefault()付きフィールドに元の初期値を補ってしまうため、
// 部分更新(PUTで一部フィールドだけ送る場合)に使うスキーマはdefault()を外して個別にoptional()化する。
export const roadmapItemUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  categoryId: z.string().min(1).optional(),
  startDate: z.coerce.date().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
  completionCriteria: z.string().optional(),
  reason: z.string().optional(),
  requiredSkills: z.string().optional(),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "ON_HOLD", "DONE"]).optional(),
  progressPercent: z.coerce.number().min(0).max(100).optional(),
});

export const diaryEntrySchema = z.object({
  date: z.coerce.date(),
  categoryId: z.string().min(1),
  content: z.string().min(1),
  aiAnalysisNote: z.string().nullable().optional(),
});

export const diaryEntryUpdateSchema = diaryEntrySchema.partial();

export const achievementSchema = z.object({
  title: z.string().min(1),
  challenge: z.string().default(""),
  action: z.string().default(""),
  result: z.string().default(""),
  metricValue: z.string().nullable().optional(),
  skillsUsed: z.string().default(""),
  role: z.string().default(""),
  isReproducible: z.coerce.boolean().default(false),
  reproducibilityNote: z.string().default(""),
  isMonetized: z.coerce.boolean().default(false),
  thirdPartyFeedback: z.string().default(""),
  evidenceUrl: z.string().nullable().optional(),
  evidenceNote: z.string().nullable().optional(),
  date: z.coerce.date(),
  categoryId: z.string().min(1),
  axisKeys: z.array(z.string()).default([]),
  sourceDiaryEntryId: z.string().nullable().optional(),
  relatedRoadmapItemId: z.string().nullable().optional(),
  relatedIndividualGoalId: z.string().nullable().optional(),
});

export const achievementUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  challenge: z.string().optional(),
  action: z.string().optional(),
  result: z.string().optional(),
  metricValue: z.string().nullable().optional(),
  skillsUsed: z.string().optional(),
  role: z.string().optional(),
  isReproducible: z.coerce.boolean().optional(),
  reproducibilityNote: z.string().optional(),
  isMonetized: z.coerce.boolean().optional(),
  thirdPartyFeedback: z.string().optional(),
  evidenceUrl: z.string().nullable().optional(),
  evidenceNote: z.string().nullable().optional(),
  date: z.coerce.date().optional(),
  categoryId: z.string().min(1).optional(),
  axisKeys: z.array(z.string()).optional(),
  relatedRoadmapItemId: z.string().nullable().optional(),
  relatedIndividualGoalId: z.string().nullable().optional(),
});

export const marketDataSchema = z.object({
  roleTitle: z.string().min(1),
  requiredSkills: z.string().default(""),
  preferredSkills: z.string().default(""),
  requiredTrackRecord: z.string().default(""),
  compensationRange: z.string().default(""),
  sourceUrl: z.string().default(""),
  sourceLabel: z.string().default(""),
  fetchedAt: z.coerce.date(),
  confirmedAt: z.coerce.date(),
  note: z.string().default(""),
});

export const marketDataUpdateSchema = z.object({
  roleTitle: z.string().min(1).optional(),
  requiredSkills: z.string().optional(),
  preferredSkills: z.string().optional(),
  requiredTrackRecord: z.string().optional(),
  compensationRange: z.string().optional(),
  sourceUrl: z.string().optional(),
  sourceLabel: z.string().optional(),
  fetchedAt: z.coerce.date().optional(),
  confirmedAt: z.coerce.date().optional(),
  note: z.string().optional(),
});

export const weeklyTodoSchema = z.object({
  weekStart: z.coerce.date(),
  dayOfWeek: z.enum(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]).default("MON"),
  title: z.string().min(1),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
  isDone: z.coerce.boolean().default(false),
  roadmapItemId: z.string().nullable().optional(),
  individualGoalId: z.string().nullable().optional(),
});

export const weeklyTodoUpdateSchema = z.object({
  weekStart: z.coerce.date().optional(),
  dayOfWeek: z.enum(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]).optional(),
  title: z.string().min(1).optional(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
  isDone: z.coerce.boolean().optional(),
  roadmapItemId: z.string().nullable().optional(),
  individualGoalId: z.string().nullable().optional(),
});

export const keyActionSchema = z.object({
  roadmapItemId: z.string().min(1),
  title: z.string().min(1),
  note: z.string().default(""),
  startDate: z.coerce.date().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  sortOrder: z.coerce.number().default(0),
});

export const keyActionUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  note: z.string().optional(),
  startDate: z.coerce.date().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  sortOrder: z.coerce.number().optional(),
  archived: z.coerce.boolean().optional(),
});

// ロードマップの重点行動からの自動生成とは別に、ユーザーが個別目標を直接登録する場合のスキーマ。
// roadmapItemId/keyActionIdは持たせず、自動同期の対象外(手動編集扱い)として作成する。
// targetMonthは月選択ではなく期限(dueDate)から自動算出するため、クライアントからは受け取らない。
// 期限は任意(未入力なら期限なしの目標として登録する)。
export const individualGoalCreateSchema = z.object({
  title: z.string().min(1),
  content: z.string().default(""),
  categoryId: z.string().min(1),
  dueDate: z.coerce.date().nullable().optional(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
});

export const individualGoalUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "ON_HOLD", "DONE"]).optional(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
  progressPercent: z.coerce.number().min(0).max(100).optional(),
  // trueを明示的に送らない限り、API側で既存値を維持する(編集操作時は自動でtrueに設定する)。
  manuallyEdited: z.coerce.boolean().optional(),
  syncDeleted: z.coerce.boolean().optional(),
});

export const longTermPlanUpdateSchema = z.object({
  longTermPlan: z.string().max(10000),
});

export const eventSchema = z.object({
  title: z.string().min(1),
  date: z.coerce.date(),
  categoryId: z.string().min(1),
  memo: z.string().default(""),
});

export const eventUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  date: z.coerce.date().optional(),
  categoryId: z.string().min(1).optional(),
  memo: z.string().optional(),
});

export const memoSchema = z.object({
  title: z.string().min(1),
  content: z.string().default(""),
});

export const memoUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional(),
});
