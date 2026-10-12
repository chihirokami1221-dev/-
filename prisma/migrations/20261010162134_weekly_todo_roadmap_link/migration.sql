ALTER TABLE "WeeklyTodoItem" ADD COLUMN "roadmapItemId" TEXT;
CREATE INDEX "WeeklyTodoItem_roadmapItemId_idx" ON "WeeklyTodoItem"("roadmapItemId");
