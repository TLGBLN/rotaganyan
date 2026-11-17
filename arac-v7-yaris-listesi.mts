// KALICI ARAÇ — V7 TEST POPÜLASYONU = /admin/kosu-tipleri sayfasındaki yarışlar (kullanıcı kararı 2026-11-17: "test edilen sinyaller bu yarışlarla test edilecek"). SALT-OKUMA.
// Filtre sayfanın getVeri() ile AYNI: sonuçlanmış, yayınlanmış tahminli (createdAt ≥ GUNCEL_MOTOR_BASLANGIC), conditions=null. Çıktı: .sinyal-veri/kosu-tipleri-yarislar.json
import fs from "node:fs";
import { db } from "./src/lib/db";
import { GUNCEL_MOTOR_BASLANGIC, normalizeClassType } from "./src/server/services/admin.service";
const rs = await db.result.findMany({ where: { race: { prediction: { published: true, createdAt: { gte: GUNCEL_MOTOR_BASLANGIC } }, conditions: null } }, select: { race: { select: { id: true, classType: true, raceDay: { select: { date: true } } } } } });
const liste = rs.map((r) => ({ raceId: r.race.id, tip: normalizeClassType(r.race.classType), tarih: r.race.raceDay.date.toISOString().slice(0, 10) }));
const tip: Record<string, number> = {}; for (const l of liste) tip[l.tip] = (tip[l.tip] ?? 0) + 1;
fs.writeFileSync(".sinyal-veri/kosu-tipleri-yarislar.json", JSON.stringify({ uretim: new Date().toISOString(), motorBaslangic: GUNCEL_MOTOR_BASLANGIC, yarislar: liste }));
console.log("sayfa popülasyonu:", liste.length, "yarış | motor başlangıcı", GUNCEL_MOTOR_BASLANGIC.toISOString().slice(0, 10), "| tarih", liste.map((l) => l.tarih).sort()[0], "→", liste.map((l) => l.tarih).sort().slice(-1)[0]);
console.log("tip dağılımı:", JSON.stringify(tip));
const M = JSON.parse(fs.readFileSync(".sinyal-veri/golgeleme-matris-tum-asof.json", "utf8")) as { yarislar: { raceId: string }[] }; const asof = new Set(M.yarislar.map((r) => r.raceId));
console.log("as-of matriste bulunan:", liste.filter((l) => asof.has(l.raceId)).length, "/", liste.length);
await db.$disconnect(); process.exit(0);
