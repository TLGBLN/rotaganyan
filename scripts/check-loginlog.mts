import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

const count = await db.loginLog.count();
const latest = await db.loginLog.findMany({
  orderBy: { createdAt: "desc" },
  take: 10,
  select: { email: true, ip: true, country: true, city: true, success: true, createdAt: true, userAgent: true },
});

console.log(`\nLoginLog kayıt sayısı: ${count}\n`);
for (const l of latest) {
  const ua = l.userAgent.includes("iPhone") ? "iPhone" : l.userAgent.includes("Android") ? "Android" : "Desktop";
  console.log(`  ${l.createdAt.toISOString().slice(0,19)} | ${l.email} | ${l.success ? "✓" : "✗"} | ${l.country ?? "?"} ${l.city ?? ""} | ${ua}`);
}

await db.$disconnect();
