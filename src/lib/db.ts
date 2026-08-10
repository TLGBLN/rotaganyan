import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  // v6.76 — kullanıcı bulgusu 2026-08-10: /program sayfası (yoğun günlerde 20+ yarış)
  // getProgramData'da YARIŞ BAŞINA 3 sorgu (sire/dam/gec-çıkış) paralel ateşliyor — 24
  // yarışlık bir günde bu 70+ eşzamanlı sorgu demek. node-postgres'in varsayılan pool
  // boyutu (10) bu yükü kaldıramayıp sorguları kendi içinde sıraya sokuyor, indeks
  // eklemenin (bkz. schema.prisma Runner/SireStatOwn/DamStatOwn) tek başına yetmemesinin
  // sebebi buydu. Supabase'in kendi PgBouncer'ı (DATABASE_URL zaten 6543 portundan onu
  // kullanıyor) asıl DB bağlantılarını çoğullayıp yönettiği için burada max'ı artırmak
  // güvenli.
  const adapter = new PrismaPg({ connectionString, max: 25 });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
