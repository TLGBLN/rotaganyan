import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL yok");

const adapter = new PrismaPg({ connectionString });
const db = new PrismaClient({ adapter });

async function main() {
  const hash = await bcrypt.hash("admin0909", 12);
  const user = await db.user.upsert({
    where: { email: "tlgbilen@gmail.com" },
    update: { passwordHash: hash, role: "ADMIN", name: "Tolga" },
    create: { email: "tlgbilen@gmail.com", name: "Tolga", passwordHash: hash, role: "ADMIN" },
  });
  console.log("✅", user.email, "→", user.role);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
