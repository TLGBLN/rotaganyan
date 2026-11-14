// KALICI ARAÇ — canlı motorun KAYITLI sinyal anlık görüntülerini (Pick.featureSnapshot) + gerçek sonuçları yerel bir
// NDJSON eğitim/CV veri setine biriktirir. Neden (2026-11-14): 25 sinyalli eğitim verisi hiçbir yerde saklanmıyordu, bu yüzden
// motor değişiklikleri (Handikap yeniden eğitimi, at-jokey, galop vb.) sınanamıyordu. Her yayınlanan koşunun anlık görüntüsü
// zaten DB'de; bu araç onu yarış SONUÇLANDIKTAN sonra yerele alır.
//
// Kural uyumu (kalıcı kural: büyük/toplu DB okuması önce yerel NDJSON'a): gün gün SIRALI sorgu, günler arası bekleme, SALT-OKUMA,
// idempotent (daha önce aktarılan raceId atlanır, kaldığı yerden devam eder). Yarış saatinde çalıştırmayın (canlı DB yükü).
//
// Çalıştırma:
//   node --env-file=.env node_modules/tsx/dist/cli.mjs arac-sinyal-veri-aktar.mts [--from 2026-11-13] [--to 2026-11-14]
// Çıktı: .sinyal-veri/anlik.ndjson (git'e GİRMEZ). Her satır = 1 koşu: tip/mesafe/zemin/irk, kazanan(lar), bitiş sırası, atlar[{no, rank, p,
// sig:[[kod, hamDeger, observed]], yaş/kilo/hp/kgs/jokey/antrenör/pedigri, ped(externalPedigree)}], motor etiketi ve sinyal sayısı.
import fs from "node:fs";
import path from "node:path";
import { db } from "./src/lib/db";

const OUT_DIR = path.join(process.cwd(), ".sinyal-veri");
const OUT = path.join(OUT_DIR, "anlik.ndjson");
const get = (b: string) => { const i = process.argv.indexOf(b); return i >= 0 ? process.argv[i + 1] : undefined; };
const from = new Date((get("--from") ?? "2026-11-13") + "T00:00:00.000Z"); // 25 sinyalli motorun ilk günü
const to = new Date((get("--to") ?? new Date().toISOString().slice(0, 10)) + "T00:00:00.000Z");

fs.mkdirSync(OUT_DIR, { recursive: true });
const done = new Set<string>();
if (fs.existsSync(OUT)) for (const l of fs.readFileSync(OUT, "utf8").split("\n")) if (l) { try { done.add(JSON.parse(l).raceId); } catch { /* bozuk satır */ } }
console.log(`Mevcut: ${done.size} koşu aktarılmış. Aralık: ${from.toISOString().slice(0, 10)} → ${to.toISOString().slice(0, 10)}`);

type Snap = { tumSinyaller?: { kod: string; hamDeger: number; observed: boolean }[]; externalPedigree?: unknown; motorEtiketi?: string } | null;
let yeni = 0;
for (let d = new Date(from); d <= to; d = new Date(d.getTime() + 86400000)) {
  const races = await db.race.findMany({
    where: { raceDay: { date: d, hippodrome: { name: { not: "Karma" } } }, result: { isNot: null }, prediction: { is: { published: true } } },
    select: {
      id: true, raceNo: true, classType: true, distance: true, surface: true, breed: true,
      raceDay: { select: { hippodrome: { select: { slug: true } } } },
      result: { select: { winnerNos: true, actualOrder: true, ganyan: true } },
      runners: { select: { id: true, no: true, age: true, weight: true, weightChange: true, hp: true, tjkKgs: true, jockey: true, trainer: true, owner: true, sire: true, dam: true, damSire: true, sameJockey: true, jockeyChanged: true, apprentice: true, startNo: true, disaridanStart: true, recentForm: true, equipmentAdded: true, equipmentRemoved: true, scratched: true } },
      prediction: { select: { picks: { select: { runnerId: true, rank: true, scoreExact: true, featureSnapshot: true } } } },
    },
  });
  let gunYeni = 0;
  for (const r of races) {
    if (done.has(r.id)) continue;
    const byId = new Map(r.runners.map((x) => [x.id, x]));
    let etiket: string | null = null, sinyalSayisi = 0;
    const atlar = (r.prediction?.picks ?? []).map((p) => {
      const rn = p.runnerId ? byId.get(p.runnerId) : undefined;
      const snap = p.featureSnapshot as Snap;
      if (!etiket && snap?.motorEtiketi) etiket = snap.motorEtiketi;
      sinyalSayisi = Math.max(sinyalSayisi, snap?.tumSinyaller?.length ?? 0);
      return {
        no: rn?.no ?? null, rank: p.rank, p: p.scoreExact,
        age: rn?.age ?? null, kilo: rn?.weight ?? null, kiloDeg: rn?.weightChange ?? null, hp: rn?.hp ?? null, kgs: rn?.tjkKgs ?? null,
        jokey: rn?.jockey ?? null, antrenor: rn?.trainer ?? null, sahip: rn?.owner ?? null, sire: rn?.sire ?? null, dam: rn?.dam ?? null, damSire: rn?.damSire ?? null,
        ayniJokey: rn?.sameJockey ?? null, jokeyDeg: rn?.jockeyChanged ?? null, apprentice: rn?.apprentice ?? null, startNo: rn?.startNo ?? null, disari: rn?.disaridanStart ?? null,
        form: rn?.recentForm ?? null, takiEk: rn?.equipmentAdded ?? null, takiCik: rn?.equipmentRemoved ?? null, kosmadi: rn?.scratched ?? false,
        sig: (snap?.tumSinyaller ?? []).map((s) => [s.kod, s.hamDeger, s.observed]),
        ped: snap?.externalPedigree ?? null,
      };
    });
    fs.appendFileSync(OUT, JSON.stringify({
      raceId: r.id, tarih: d.toISOString().slice(0, 10), hip: r.raceDay.hippodrome.slug, kosu: r.raceNo, tip: r.classType, mesafe: r.distance, zemin: r.surface, irk: r.breed,
      kazananlar: r.result?.winnerNos ?? [], sira: r.result?.actualOrder ?? null, ganyan: r.result?.ganyan ?? null, motor: etiket, sinyalSayisi, atlar,
    }) + "\n");
    done.add(r.id); gunYeni++; yeni++;
  }
  console.log(d.toISOString().slice(0, 10), "|", races.length, "sonuçlanmış koşu |", gunYeni, "yeni aktarıldı");
  await new Promise((res) => setTimeout(res, 1500)); // canlı DB'ye nazik
}
// özet
const rows = fs.readFileSync(OUT, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const bySayi: Record<string, number> = {}, byTip: Record<string, number> = {};
for (const x of rows) { bySayi[x.sinyalSayisi] = (bySayi[x.sinyalSayisi] ?? 0) + 1; const t = String(x.tip ?? "?").split("/")[0].replace(/\s+\d+$/, ""); byTip[t] = (byTip[t] ?? 0) + 1; }
console.log(`\nTOPLAM veri seti: ${rows.length} koşu (bu çalıştırmada +${yeni}) → ${OUT}`);
console.log("Sinyal sayısına göre:", JSON.stringify(bySayi), "| Tipe göre:", JSON.stringify(byTip));
process.exit(0);
