-- AlterTable
-- WeeklyTodoItemへ、タスクごとの自由記述メモを追加する(既存行はDEFAULT ''で埋まる、非破壊)。
ALTER TABLE "WeeklyTodoItem" ADD COLUMN "memo" TEXT NOT NULL DEFAULT '';
