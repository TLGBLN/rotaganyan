// KALICI ARAÇ (2026-09-17) — PedigreeSurfaceAffinity için sızıntısız backfill.
// SireStatOwn/DamSireStatOwn'u DOĞRUDAN kullanmıyor (point-in-time DEĞİLLER — her gün
// tüm geçmişi tarih filtresiz yeniden hesaplıyorlar, sireOrani'nin daha önce yakalanan
// AYNI sızıntı sınıfı). Bunun yerine arac-model-veri-olustur.mts'in kendi sireIndex
// desenini (KENDİ Runner/Result arşivimizden, cutoff-tarihli) tekrar kurar — TEK FARK:
// mesafe kovası YOK (yalnız irk|pist), çünkü asıl soru "bu sire/damsire HANGİ PİSTTE
// daha güçlü" — mesafeyi de eklemek örneklemi fazla seyreltir (v1 basitleştirmesi).
//
// PedigreeSurfaceAffinity_i = ortalama(SireAffinity_i, DamSireAffinity_i), her biri:
//   Affinity = ShrinkPct(bu pist) - ShrinkPct(diğer pist(ler), aynı irk)
// Yalnız GERÇEK veri olan (start>0) taraf hesaba katılır, veri yoksa o bileşen atlanır;
// HİÇBİRİ yoksa null (nötr 0, "pedigri bilinmiyor" ile "pedigri nötr" KARIŞTIRILMAZ).
// Çalıştırma: node --env-file=.env node_modules/tsx/dist/cli.mjs arac-yeni-sinyal-backfill-pedigree.mts
import { readFileSync, writeFileSync } from "fs";
import { db } from "./src/lib/db";
import { breedToIrk, surfaceToPist, normalizeSireName } from "./src/lib/sire-stat-match";
import { finishPos } from "./src/lib/race-result";

const IN_PATH =
  "C:\\Users\\tlgbi\\AppData\\Local\\Temp\\claude\\c--Users-tlgbi-OneDrive-Belgeler-Rota\\76598f4f-31f1-4414-a3f6-fbab0aab98d4\\scratchpad\\model-veri-yeni-adaylar-stil.json";
const OUT_PATH =
  "C:\\Users\\tlgbi\\AppData\\Local\\Temp\\claude\\c--Users-tlgbi-OneDrive-Belgeler-Rota\\76598f4f-31f1-4414-a3f6-fbab0aab98d4\\scratchpad\\model-veri-yeni-adaylar-pedigree.json";

const POP_ORT = 0.1; // genel galibiyet oranı priorı (sireOrani ile aynı büyüklük mertebesi)
const K = 20; // shrinkage k (sireOrani ile aynı)
function shrink(wins: number, starts: number, k = K): number {
  return (wins + k * POP_ORT) / (starts + k);
}

type RowIn = { raceId: string; runnerId: string; no: number; [k: string]: unknown };
type GecmisNokta = { tarih: Date; pos: number | null };

async function main() {
  const rows: RowIn[] = JSON.parse(readFileSync(IN_PATH, "utf-8"));
  const raceIds = [...new Set(rows.map((r) => r.raceId))];
  console.log(`${rows.length} satır, ${raceIds.length} koşu.`);

  const races = await db.race.findMany({
    where: { id: { in: raceIds } },
    select: { id: true, breed: true, surface: true, raceDay: { select: { date: true } } },
  });
  const raceInfoById = new Map(races.map((r) => [r.id, { breed: r.breed, surface: r.surface, date: r.raceDay.date }]));

  const runnerIds = [...new Set(rows.map((r) => r.runnerId))];
  const pedigreeByRunnerId = new Map<string, { sire: string | null; damSire: string | null; name: string }>();
  const CHUNK = 3000;
  for (let i = 0; i < runnerIds.length; i += CHUNK) {
    const dilim = runnerIds.slice(i, i + CHUNK);
    const runners = await db.runner.findMany({ where: { id: { in: dilim } }, select: { id: true, sire: true, damSire: true, name: true } });
    for (const r of runners) pedigreeByRunnerId.set(r.id, { sire: r.sire, damSire: r.damSire, name: r.name });
  }

  // Kullanıcının stratifikasyon isteği (0-1 vs 2+ bu-pistte kendi start'ı) için: at
  // isim bazlı, bu pistte KAÇ KEZ koştuğu (sızıntısız) — sireIndex/damSireIndex ile
  // AYNI havuzdan (tumGecmisRunnerlar zaten at adı taşımıyor, ayrı ve KÜÇÜK bir sorgu).
  const atIsimleri = [...new Set([...pedigreeByRunnerId.values()].map((p) => p.name))];
  console.log(`Atın kendi pist deneyimi için ${atIsimleri.length} at ismi taranıyor...`);
  const atGecmisIndex = new Map<string, GecmisNokta[]>(); // key = pist|isim
  const AT_CHUNK = 500;
  for (let i = 0; i < atIsimleri.length; i += AT_CHUNK) {
    const dilim = atIsimleri.slice(i, i + AT_CHUNK);
    const gecmisAtRunnerlar = await db.runner.findMany({
      where: { name: { in: dilim }, scratched: false },
      select: { name: true, race: { select: { surface: true, raceDay: { select: { date: true } } } } },
    });
    for (const r of gecmisAtRunnerlar) {
      const pist = surfaceToPist(r.race.surface);
      const key = `${pist}|${r.name}`;
      const arr = atGecmisIndex.get(key) ?? [];
      arr.push({ tarih: r.race.raceDay.date, pos: null });
      atGecmisIndex.set(key, arr);
    }
  }
  function kendiPistDeneyimi(name: string, pist: string, cutoff: Date): number {
    const arr = atGecmisIndex.get(`${pist}|${name}`);
    if (!arr) return 0;
    return arr.filter((g) => g.tarih.getTime() < cutoff.getTime()).length;
  }

  console.log("Tarihe-duyarlı sire+damSire geçmişi yükleniyor (TÜM arşiv, tek seferlik)...");
  const tumGecmisRunnerlar = await db.runner.findMany({
    where: { scratched: false, race: { result: { isNot: null } } },
    select: {
      sire: true, damSire: true, no: true,
      race: { select: { breed: true, surface: true, raceDay: { select: { date: true } }, result: { select: { actualOrder: true, winnerNos: true } } } },
    },
  });
  console.log(`Geçmiş havuzu: ${tumGecmisRunnerlar.length} at satırı`);

  // Anahtar: irk|pist|isim (mesafesiz — v1 basitleştirmesi, dosya başı notu).
  const sireIndex = new Map<string, GecmisNokta[]>();
  const damSireIndex = new Map<string, GecmisNokta[]>();
  function ekle(index: Map<string, GecmisNokta[]>, name: string | null, irk: string, pist: string, tarih: Date, pos: number | null) {
    if (!name) return;
    const key = `${irk}|${pist}|${normalizeSireName(name)}`;
    const arr = index.get(key) ?? [];
    arr.push({ tarih, pos });
    index.set(key, arr);
  }
  for (const r of tumGecmisRunnerlar) {
    if (!r.race.result) continue;
    const pos = finishPos(r.race.result.actualOrder, r.no, r.race.result.winnerNos);
    const irk = breedToIrk(r.race.breed);
    const pist = surfaceToPist(r.race.surface);
    const tarih = r.race.raceDay.date;
    ekle(sireIndex, r.sire, irk, pist, tarih, pos);
    ekle(damSireIndex, r.damSire, irk, pist, tarih, pos);
  }

  // cutoff'tan KESİNLİKLE önceki kayıtlarla (start, wins) — sızıntısız.
  function oranHesapla(index: Map<string, GecmisNokta[]>, key: string, cutoff: Date): { start: number; wins: number } {
    const arr = index.get(key);
    if (!arr) return { start: 0, wins: 0 };
    let start = 0, wins = 0;
    for (const g of arr) {
      if (g.tarih.getTime() >= cutoff.getTime()) continue;
      start++;
      if (g.pos === 1) wins++;
    }
    return { start, wins };
  }

  const DIGER_PISTLER: Record<string, string[]> = { CIM: ["KUM", "SENTETIK"], KUM: ["CIM", "SENTETIK"], SENTETIK: ["CIM", "KUM"] };

  function affinityHesapla(index: Map<string, GecmisNokta[]>, name: string | null, irk: string, pist: string, cutoff: Date): number | null {
    if (!name) return null;
    const normName = normalizeSireName(name);
    const buPist = oranHesapla(index, `${irk}|${pist}|${normName}`, cutoff);
    let digerStart = 0, digerWins = 0;
    for (const dp of DIGER_PISTLER[pist] ?? []) {
      const o = oranHesapla(index, `${irk}|${dp}|${normName}`, cutoff);
      digerStart += o.start; digerWins += o.wins;
    }
    if (buPist.start === 0 && digerStart === 0) return null; // bu sire hakkında hiç veri yok
    const buPct = shrink(buPist.wins, buPist.start);
    const digerPct = shrink(digerWins, digerStart);
    return (buPct - digerPct) * 100; // yüzde puanı cinsinden fark
  }

  console.log("PedigreeSurfaceAffinity hesaplanıyor...");
  let islenen = 0;
  const sonuclar = rows.map((row) => {
    const info = raceInfoById.get(row.raceId);
    const pedigree = pedigreeByRunnerId.get(row.runnerId);
    islenen++;
    if (islenen % 8000 === 0) console.log(`  ${islenen}/${rows.length}`);
    if (!info || !pedigree) return { ...row, pedigreeSurfaceAffinity: null, sireStartToplam: 0 };
    const irk = breedToIrk(info.breed);
    const pist = surfaceToPist(info.surface);
    const sireAff = affinityHesapla(sireIndex, pedigree.sire, irk, pist, info.date);
    const damSireAff = affinityHesapla(damSireIndex, pedigree.damSire, irk, pist, info.date);
    const bilesenler = [sireAff, damSireAff].filter((x): x is number => x != null);
    const pedigreeSurfaceAffinity = bilesenler.length > 0 ? bilesenler.reduce((a, b) => a + b, 0) / bilesenler.length : null;
    const ownSurfaceStartSayisi = kendiPistDeneyimi(pedigree.name, pist, info.date);
    return { ...row, pedigreeSurfaceAffinity, sireAffinity: sireAff, damSireAffinity: damSireAff, ownSurfaceStartSayisi };
  });
  await db.$disconnect();

  const doluSayisi = sonuclar.filter((r: any) => r.pedigreeSurfaceAffinity != null).length;
  console.log(`Toplam ${rows.length} satır, pedigreeSurfaceAffinity dolu: ${doluSayisi} (%${((100 * doluSayisi) / rows.length).toFixed(1)})`);
  writeFileSync(OUT_PATH, JSON.stringify(sonuclar));
  console.log(`Yazıldı: ${OUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
