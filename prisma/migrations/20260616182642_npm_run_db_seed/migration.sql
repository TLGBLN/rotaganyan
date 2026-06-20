-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'EDITOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PREMIUM');

-- CreateEnum
CREATE TYPE "Surface" AS ENUM ('CIM', 'KUM', 'SENTETIK');

-- CreateEnum
CREATE TYPE "Breed" AS ENUM ('ARAP', 'INGILIZ');

-- CreateEnum
CREATE TYPE "Confidence" AS ENUM ('DUSUK', 'ORTA', 'YUKSEK');

-- CreateEnum
CREATE TYPE "PedigreeRating" AS ENUM ('ZAYIF', 'DUSUK', 'ORTA', 'GUCLU', 'YUKSEK', 'COK_YUKSEK', 'SORU', 'BILINMIYOR');

-- CreateEnum
CREATE TYPE "ArticleType" AS ENUM ('EDUCATIONAL', 'MAGAZINE');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_PREDICTION', 'NEW_ARTICLE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "LessonCategory" AS ENUM ('DERECE', 'SICIL_KILO', 'AGF', 'TEMPO', 'TUM_ATLAR', 'BANKO', 'JOKEY', 'GALOP', 'TAKI', 'GRUP', 'GENEL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Hippodrome" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "Hippodrome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaceDay" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "hippodromeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RaceDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Race" (
    "id" TEXT NOT NULL,
    "raceDayId" TEXT NOT NULL,
    "raceNo" INTEGER NOT NULL,
    "time" TEXT,
    "classType" TEXT NOT NULL,
    "breed" "Breed" NOT NULL,
    "surface" "Surface" NOT NULL,
    "distance" INTEGER NOT NULL,
    "conditions" TEXT,
    "ageWeight" TEXT,
    "trackRecord" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Race_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Runner" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "no" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "sire" TEXT,
    "dam" TEXT,
    "damSire" TEXT,
    "pedigreeNote" TEXT,
    "pedigreeUrl" TEXT,
    "jockey" TEXT,
    "trainer" TEXT,
    "startNo" INTEGER,
    "weight" DOUBLE PRECISION,
    "weightChange" DOUBLE PRECISION,
    "equipment" TEXT,
    "equipmentAdded" TEXT,
    "equipmentRemoved" TEXT,
    "sameJockey" BOOLEAN NOT NULL DEFAULT false,
    "agf" DOUBLE PRECISION,
    "raceStyle" JSONB,

    CONSTRAINT "Runner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gallop" (
    "id" TEXT NOT NULL,
    "runnerId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "track" TEXT,
    "surface" "Surface",
    "jockey" TEXT,
    "form" TEXT,
    "splits" JSONB NOT NULL,

    CONSTRAINT "Gallop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prediction" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "confidence" "Confidence" NOT NULL DEFAULT 'ORTA',
    "notes" TEXT NOT NULL,
    "tempo" TEXT,
    "couponNarrow" TEXT,
    "couponNormal" TEXT,
    "couponWide" TEXT,
    "isBanko" BOOLEAN NOT NULL DEFAULT false,
    "bankoNote" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pick" (
    "id" TEXT NOT NULL,
    "predictionId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "runnerId" TEXT,
    "runnerLabel" TEXT NOT NULL,
    "score" INTEGER,
    "details" JSONB NOT NULL,
    "pedigreeRating" "PedigreeRating" NOT NULL DEFAULT 'BILINMIYOR',
    "isTarget" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Pick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Result" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "actualOrder" JSONB NOT NULL,
    "winnerNo" INTEGER,
    "hitTop1" BOOLEAN NOT NULL DEFAULT false,
    "hitInCoupon" BOOLEAN NOT NULL DEFAULT false,
    "hitRanks" JSONB,
    "errorTag" TEXT,
    "errorNote" TEXT,
    "cikan" TEXT,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "type" "ArticleType" NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "body" TEXT NOT NULL,
    "coverImage" TEXT,
    "category" TEXT,
    "tags" TEXT[],
    "authorId" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "ogImage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MethodologyVersion" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "content" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MethodologyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostMortemLesson" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "category" "LessonCategory" NOT NULL,
    "rule" TEXT NOT NULL,
    "raceRef" TEXT,
    "resultId" TEXT,
    "tags" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostMortemLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EngineConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EngineConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Hippodrome_name_key" ON "Hippodrome"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Hippodrome_slug_key" ON "Hippodrome"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "RaceDay_date_hippodromeId_key" ON "RaceDay"("date", "hippodromeId");

-- CreateIndex
CREATE UNIQUE INDEX "Race_raceDayId_raceNo_key" ON "Race"("raceDayId", "raceNo");

-- CreateIndex
CREATE UNIQUE INDEX "Runner_raceId_no_key" ON "Runner"("raceId", "no");

-- CreateIndex
CREATE UNIQUE INDEX "Prediction_raceId_key" ON "Prediction"("raceId");

-- CreateIndex
CREATE UNIQUE INDEX "Pick_predictionId_rank_key" ON "Pick"("predictionId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "Result_raceId_key" ON "Result"("raceId");

-- CreateIndex
CREATE UNIQUE INDEX "Article_slug_key" ON "Article"("slug");

-- CreateIndex
CREATE INDEX "Article_type_published_idx" ON "Article"("type", "published");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE UNIQUE INDEX "MethodologyVersion_version_key" ON "MethodologyVersion"("version");

-- CreateIndex
CREATE INDEX "PostMortemLesson_category_active_idx" ON "PostMortemLesson"("category", "active");

-- CreateIndex
CREATE UNIQUE INDEX "EngineConfig_key_key" ON "EngineConfig"("key");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaceDay" ADD CONSTRAINT "RaceDay_hippodromeId_fkey" FOREIGN KEY ("hippodromeId") REFERENCES "Hippodrome"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Race" ADD CONSTRAINT "Race_raceDayId_fkey" FOREIGN KEY ("raceDayId") REFERENCES "RaceDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Runner" ADD CONSTRAINT "Runner_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gallop" ADD CONSTRAINT "Gallop_runnerId_fkey" FOREIGN KEY ("runnerId") REFERENCES "Runner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pick" ADD CONSTRAINT "Pick_predictionId_fkey" FOREIGN KEY ("predictionId") REFERENCES "Prediction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pick" ADD CONSTRAINT "Pick_runnerId_fkey" FOREIGN KEY ("runnerId") REFERENCES "Runner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostMortemLesson" ADD CONSTRAINT "PostMortemLesson_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "Result"("id") ON DELETE SET NULL ON UPDATE CASCADE;
