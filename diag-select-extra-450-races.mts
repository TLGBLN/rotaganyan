// FAZ 1 takip — kullanıcı kararı (2026-10-22): "~600 yarışa genişlet". Mevcut 120 TRAIN +
// 30 HOLDOUT (ab-split-locked.json) SABİT kalır, DOKUNULMAZ (K3 kuralı: sonuçlara bakılmadan
// kilitlenmiş split değiştirilmez). Bu yalnız FAZ 2'nin BETİMSEL (yeniden eğitim YOK) sinyal×
// yarış-tipi analizi için ek 450 yarış seçer — eşit-aralıklı (stride), bugünün 16 vaka
// yarışı VE mevcut 150 HARİÇ.
import { db } from "./src/lib/db";
import fs from "node:fs";

const EXTRA_SIZE = 450;
const CUTOFF = new Date("2026-10-20T00:00:00.000Z"); // bugünün 16 vaka yarışı (10-21/22) HARİÇ

function stride<T>(items: T[], n: number): T[] {
  if (items.length <= n) return items;
  const out: T[] = [];
  const step = items.length / n;
  for (let i = 0; i < n; i++) out.push(items[Math.floor(i * step)]);
  return out;
}

async function main() {
  const lock = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/ab-split-locked.json", "utf8")) as {
    trainRaceIds: string[]; holdoutRaceIds: string[];
  };
  const existing = new Set([...lock.trainRaceIds, ...lock.holdoutRaceIds]);

  const candidates = await db.race.findMany({
    where: {
      result: { isNot: null },
      runners: { some: { scratched: false } },
      raceDay: { date: { lt: CUTOFF } },
    },
    select: { id: true, raceDay: { select: { date: true } }, runners: { where: { scratched: false }, select: { id: true } } },
    orderBy: { raceDay: { date: "asc" } },
  });
  const eligible = candidates.filter((r) => r.runners.length >= 3 && !existing.has(r.id));
  console.log(`Uygun aday havuzu (mevcut 150 ve bugünün vaka yarışları hariç): ${eligible.length}`);

  const picked = stride(eligible, EXTRA_SIZE);
  console.log(`Seçilen: ${picked.length} yarış, ${picked[0].raceDay.date.toISOString().slice(0,10)} -> ${picked[picked.length-1].raceDay.date.toISOString().slice(0,10)}`);

  fs.writeFileSync("C:/tmp/extra-450-race-ids.json", JSON.stringify(picked.map((r) => r.id), null, 2));

  // Birleşik 600 (150 mevcut + 450 yeni) liste — full-cache-builder'a doğrudan verilecek
  const combined = [...existing, ...picked.map((r) => r.id)];
  fs.writeFileSync("C:/tmp/combined-600-race-ids.json", JSON.stringify(combined, null, 2));
  console.log(`Birleşik liste: ${combined.length} yarış -> C:/tmp/combined-600-race-ids.json`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
