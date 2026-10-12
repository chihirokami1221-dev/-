-- RoadmapItemの詳細系カラムにデフォルト値を付与(新規作成時は未入力でもよいようにする。既存の値は変更しない)
-- SQLiteではALTER COLUMN SET DEFAULTを直接サポートしないため、Prisma db pushがテーブル再作成で対応済み。
-- このファイルは履歴整合のための記録。

ALTER TABLE "KeyAction" ADD COLUMN "startDate" DATETIME;
ALTER TABLE "KeyAction" ADD COLUMN "dueDate" DATETIME;
