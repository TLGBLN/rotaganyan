import { db } from "@/lib/db";
async function main() {
  const id = "cmv6qpnod00y106l34g3i7g2d"; // Karma — 1. Altılı, 2026-10-13, isActive:true, en güncel
  const updated = await db.homeKupon.update({
    where: { id },
    data: { ikramiye: "6'lı Ganyan 1.335,37 ₺ vermiştir." },
    select: { id: true, hippodromeName: true, date: true, slot: true, ikramiye: true, isActive: true },
  });
  console.log(JSON.stringify(updated, null, 2));
  await db.$disconnect();
}
main().catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
