CREATE TABLE "KeyAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roadmapItemId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KeyAction_roadmapItemId_fkey" FOREIGN KEY ("roadmapItemId") REFERENCES "RoadmapItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "KeyAction_roadmapItemId_idx" ON "KeyAction"("roadmapItemId");

CREATE TABLE "IndividualGoal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "targetMonth" DATETIME NOT NULL,
    "categoryId" TEXT NOT NULL,
    "roadmapItemId" TEXT,
    "keyActionId" TEXT,
    "dueDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "manuallyEdited" BOOLEAN NOT NULL DEFAULT false,
    "syncDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IndividualGoal_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "IndividualGoal_roadmapItemId_fkey" FOREIGN KEY ("roadmapItemId") REFERENCES "RoadmapItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "IndividualGoal_keyActionId_fkey" FOREIGN KEY ("keyActionId") REFERENCES "KeyAction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "IndividualGoal_keyActionId_targetMonth_key" ON "IndividualGoal"("keyActionId", "targetMonth");
CREATE INDEX "IndividualGoal_targetMonth_idx" ON "IndividualGoal"("targetMonth");
CREATE INDEX "IndividualGoal_roadmapItemId_idx" ON "IndividualGoal"("roadmapItemId");
CREATE INDEX "IndividualGoal_categoryId_idx" ON "IndividualGoal"("categoryId");

ALTER TABLE "WeeklyTodoItem" ADD COLUMN "individualGoalId" TEXT;
CREATE INDEX "WeeklyTodoItem_individualGoalId_idx" ON "WeeklyTodoItem"("individualGoalId");
