-- AlterTable
ALTER TABLE "HomeKupon" ADD COLUMN     "slot" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "HomeKupon_slot_idx" ON "HomeKupon"("slot");
