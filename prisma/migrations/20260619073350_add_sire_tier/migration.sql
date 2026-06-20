-- CreateTable
CREATE TABLE "SireTier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tier" "PedigreeRating" NOT NULL,
    "surface" "Surface",
    "breed" "Breed",
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SireTier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SireTier_name_key" ON "SireTier"("name");
