-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WeeklyTodoItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weekStart" DATETIME NOT NULL,
    "dayOfWeek" TEXT NOT NULL DEFAULT 'MON',
    "title" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_WeeklyTodoItem" ("createdAt", "id", "isDone", "priority", "title", "updatedAt", "weekStart") SELECT "createdAt", "id", "isDone", "priority", "title", "updatedAt", "weekStart" FROM "WeeklyTodoItem";
DROP TABLE "WeeklyTodoItem";
ALTER TABLE "new_WeeklyTodoItem" RENAME TO "WeeklyTodoItem";
CREATE INDEX "WeeklyTodoItem_weekStart_idx" ON "WeeklyTodoItem"("weekStart");
CREATE INDEX "WeeklyTodoItem_dayOfWeek_idx" ON "WeeklyTodoItem"("dayOfWeek");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
