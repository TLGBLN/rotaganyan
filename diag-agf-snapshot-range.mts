import { db } from "./src/lib/db";
async function main() {
  const [earliest, latest, count] = await Promise.all([
    db.agfSnapshot.findFirst({ orderBy: { capturedAt: "asc" }, select: { capturedAt: true } }),
    db.agfSnapshot.findFirst({ orderBy: { capturedAt: "desc" }, select: { capturedAt: true } }),
    db.agfSnapshot.count(),
  ]);
  console.log("AgfSnapshot araligi:", earliest?.capturedAt, "->", latest?.capturedAt, "toplam:", count);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
