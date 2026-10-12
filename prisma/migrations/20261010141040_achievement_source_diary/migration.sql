-- AlterTable
ALTER TABLE "Achievement" ADD COLUMN "sourceDiaryEntryId" TEXT;

-- CreateIndex
CREATE INDEX "Achievement_sourceDiaryEntryId_idx" ON "Achievement"("sourceDiaryEntryId");
