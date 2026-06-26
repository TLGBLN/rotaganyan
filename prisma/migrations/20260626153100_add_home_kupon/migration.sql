-- CreateTable
CREATE TABLE "HomeKupon" (
    "id" TEXT NOT NULL,
    "hippodromeName" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "legs" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeKupon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomeKupon_isActive_idx" ON "HomeKupon"("isActive");
