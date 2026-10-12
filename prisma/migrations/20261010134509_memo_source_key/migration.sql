-- AlterTable
ALTER TABLE "Memo" ADD COLUMN "sourceKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Memo_sourceKey_key" ON "Memo"("sourceKey");
