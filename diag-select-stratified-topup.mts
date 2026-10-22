// Kullanıcı talebi (2026-10-22): "en hızlı ve doğru veri" — 450 yarışı körlemesine eklemek
// yerine yalnız İNCE hücreleri (Aile x Pist, Aile=Handikap/Şartlı/Maiden/KV) FLOOR=18'e
// kadar takviye eder. Zaten yeterli olan hücrelere (ör. Handikap×Kum=33) dokunmaz.
import { db } from "./src/lib/db";
import fs from "node:fs";

const FLOOR = 16;
const CUTOFF = new Date("2026-10-20T00:00:00.000Z");

function aile(classType: string | null): string {
  if (classType === "—" || classType == null) return "BİLİNMİYOR";
  const c = classType.toUpperCase();
  if (c.includes("KISA VADE HANDİKAP") || c.includes("KISA VADE HANDIKAP")) return "HANDİKAP";
  if (c.startsWith("HANDİKAP") || c.startsWith("HANDIKAP")) return "HANDİKAP";
  if (c.startsWith("MAIDEN")) return "MAIDEN";
  if (c.startsWith("ŞARTLI") || c.startsWith("SARTLI")) return "ŞARTLI";
  if (c.startsWith("KV-") || c.startsWith("KV ")) return "KV";
  if (c.startsWith("G ") || c.startsWith("G2") || c.startsWith("G3")) return "GRUP";
  if (c.startsWith("SATIŞ") || c.startsWith("SATIS")) return "SATIŞ";
  return "DİĞER";
}
function stride<T>(items: T[], n: number): T[] {
  if (items.length <= n) return items;
  const out: T[] = [];
  const step = items.length / n;
  for (let i = 0; i < n; i++) out.push(items[Math.floor(i * step)]);
  return out;
}

async function main() {
  const existingRows = JSON.parse(fs.readFileSync("C:/tmp/faz1-raw-rows.json", "utf8")) as { id: string; classType: string; surface: string }[];
  const lock = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/ab-split-locked.json", "utf8")) as { trainRaceIds: string[]; holdoutRaceIds: string[] };
  const existingIds = new Set([...lock.trainRaceIds, ...lock.holdoutRaceIds]);

  const AILELER = ["HANDİKAP", "ŞARTLI", "MAIDEN", "KV"];
  const PISTLER = ["CIM", "KUM", "SENTETIK"];

  const currentCount = new Map<string, number>();
  for (const r of existingRows) {
    const a = aile(r.classType);
    if (!AILELER.includes(a)) continue;
    const key = `${a}|${r.surface}`;
    currentCount.set(key, (currentCount.get(key) ?? 0) + 1);
  }

  console.log("Mevcut hücre büyüklükleri ve eksikler (floor=" + FLOOR + "):");
  const deficits: { aile: string; surface: string; have: number; need: number }[] = [];
  for (const a of AILELER) {
    for (const p of PISTLER) {
      const have = currentCount.get(`${a}|${p}`) ?? 0;
      const need = Math.max(0, FLOOR - have);
      console.log(`  ${a.padEnd(10)} ${p.padEnd(10)} mevcut=${have} eksik=${need}`);
      if (need > 0) deficits.push({ aile: a, surface: p, have, need });
    }
  }

  const picked: string[] = [];
  for (const d of deficits) {
    const candidates = await db.race.findMany({
      where: {
        result: { isNot: null },
        runners: { some: { scratched: false } },
        raceDay: { date: { lt: CUTOFF } },
        surface: d.surface as never,
      },
      select: { id: true, classType: true, raceDay: { select: { date: true } }, runners: { where: { scratched: false }, select: { id: true } } },
      orderBy: { raceDay: { date: "asc" } },
    });
    const eligible = candidates.filter((r) => r.runners.length >= 3 && !existingIds.has(r.id) && !picked.includes(r.id) && aile(r.classType) === d.aile);
    const chosen = stride(eligible, d.need);
    console.log(`${d.aile}|${d.surface}: aday havuzu=${eligible.length}, seçilen=${chosen.length}`);
    picked.push(...chosen.map((r) => r.id));
  }

  console.log(`\nToplam hedefli seçilen: ${picked.length} yarış`);
  const combined = [...existingIds, ...picked];
  fs.writeFileSync("C:/tmp/stratified-topup-race-ids.json", JSON.stringify(picked, null, 2));
  fs.writeFileSync("C:/tmp/combined-stratified-race-ids.json", JSON.stringify(combined, null, 2));
  console.log(`Birleşik liste: ${combined.length} yarış -> C:/tmp/combined-stratified-race-ids.json`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
