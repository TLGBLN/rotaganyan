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
  // boyutu (10) bu yükü kaldıramayıp sorguları kendi içinde sıraya sokuyor — YAVAŞLIK
  // yaratıyordu, HATA değil (Prisma fazlasını kendi içinde güvenle kuyruğa alır).
  //
  // v6.76'da bu yüzden max 25'e çıkarılmıştı — AMA o karar Postgres'in gerçek sunucu
  // tarafı sınırını (max_connections) BİLMEDEN alınmıştı. 2026-08-19 doğrulaması: gerçek
  // sınır yalnızca 60. Tek bir istek (25) + birkaç eşzamanlı gerçek kullanıcı isteği +
  // admin/cron işlemleri kolayca bu sınırı aşıp GERÇEK bağlantı reddi/ECHECKOUTTIMEOUT
  // hatalarına yol açıyordu (canlı sitede doğrulandı). 10'a geri döndürüldü — bilinen
  // tek maliyeti /program'ın çok yoğun günlerde biraz daha yavaş sıraya girmesi (hata
  // değil), buna karşılık gerçek bağlantı tükenmesi riski ortadan kalkıyor. max'ı
  // tekrar yükseltmeden önce mutlaka Supabase'in güncel max_connections değeri kontrol
  // edilmeli.
  const adapter = new PrismaPg({ connectionString, max: 10 });

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
