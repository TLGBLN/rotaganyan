// KALICI ARAÇ (2026-09-22) — Jokey Kimlik Altyapısı, Faz J0 Historical Backfill.
// Kullanıcı onayı (birebir): "ONAYLIYORUM: Historical Runner.tjkJokeyId backfill'i yalnız
// TJK historical program sayfasından doğrudan QueryParameter_JokeyId ile deterministik
// olarak doğrulanan ve Runner.tjkJokeyId IS NULL olan satırlara uygulanabilir. İsim/fuzzy/
// surname tahmini kullanılmayacak. Mevcut non-null ID asla overwrite edilmeyecek..."
//
// DÖRT AŞAMA, HER ZAMAN BU SIRAYLA:
//   1) Uzlaştırma raporu (canlı sayılarla) — kaç satır neden kapsam dışı.
//   2) Conflict-check: ZATEN tjkJokeyId'si dolu satırlar (forward-capture) için AYNI
//      tarihi yeniden çekip direct-ID ile karşılaştırır. conflict>0 ise SCRIPT KENDİSİ
//      DURUR — --apply verilse bile hiçbir yazma yapılmaz (kod-seviyesi guard, yalnız
//      operatör disiplinine güvenilmiyor).
//   3) Sınıflandırma: TÜM backfill adayı satırlar (tjkJokeyId IS NULL) için historical
//      sayfa yeniden çekilip WRITE/NO-WRITE kararı verilir (kurallar aşağıda).
//   4) YALNIZ `--apply` (veya APPLY=1) verilirse VE conflict==0 ise: WRITE listesi 500'lük
//      chunk'larla BULK SQL UPDATE (tek round-trip/chunk, VALUES listesiyle) ile yazılır —
//      idempotency guard'ı (r."tjkJokeyId" IS NULL) her satırda WHERE koşulunda korunuyor.
//      2026-09-22 — İLK sürüm 500 ayrı updateMany() (satır-başına round-trip) kullanıyordu,
//      canlıda saatler sürecek kadar yavaş çıktı (52.676 satır × ağ gecikmesi) — kullanıcıya
//      bildirilip DURDURULDU (~3229 satır zaten yazılmıştı, idempotent WHERE sayesinde kaldığı
//      yerden güvenle devam edilebilir), bulk UPDATE...FROM(VALUES...) desenine geçildi.
//
// Varsayılan: DRY-RUN (hiçbir yazma yapmaz). Kullanım:
//   node --env-file=.env node_modules/tsx/dist/cli.mjs arac-jokey-historical-backfill.mts
//   APPLY=1 node --env-file=.env node_modules/tsx/dist/cli.mjs arac-jokey-historical-backfill.mts
import { discoverTurkishCities, fetchCityProgram } from "./src/server/services/ingest/tjk-info.adapter";
import { db } from "./src/lib/db";
import { Prisma } from "@prisma/client";

const APPLY = process.env.APPLY === "1";
const CHUNK_BOYUTU = 500;

function toTjkDateStr(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

type FetchedRunner = { tjkJokeyId?: number; tjkAtId?: number };

// 2026-09-22 kullanıcı talebi ("en kısa sürede bitir") — sıralı fetch yerine sınırlı
// paralellik: her worker kendi 150ms nezaket gecikmesini korur, CONCURRENCY worker aynı
// anda çalışır (TJK'ya tek seferde ~CONCURRENCY istek, toplu saldırı değil).
const CONCURRENCY = 6;
async function paralelIsle<T>(items: T[], worker: (item: T) => Promise<void>): Promise<void> {
  let idx = 0;
  async function calis() {
    while (idx < items.length) {
      const i = idx++;
      await worker(items[i]);
      await new Promise((res) => setTimeout(res, 150));
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, calis));
}

async function fetchPairMap(dateIso: string, hippoName: string, hippoSlug: string): Promise<Map<string, FetchedRunner> | "PAGE_UNAVAILABLE"> {
  const date = new Date(dateIso + "T00:00:00.000Z");
  const tjkDate = toTjkDateStr(date);
  let cities;
  try {
    cities = await discoverTurkishCities(tjkDate);
  } catch {
    return "PAGE_UNAVAILABLE";
  }
  const city = cities.find((c) => c.sehirAdi === hippoName) ?? cities.find((c) => c.sehirAdi.toUpperCase() === hippoName.toUpperCase());
  if (!city) return "PAGE_UNAVAILABLE";
  let program;
  try {
    program = await fetchCityProgram(city, tjkDate);
  } catch {
    return "PAGE_UNAVAILABLE";
  }
  if (!program) return "PAGE_UNAVAILABLE";
  const map = new Map<string, FetchedRunner>();
  for (const race of program.races) {
    for (const runner of race.runners) {
      map.set(`${race.raceNo}|${runner.no}`, { tjkJokeyId: runner.tjkJokeyId, tjkAtId: runner.tjkAtId });
    }
  }
  return map;
}

async function main() {
  console.log(`Mod: ${APPLY ? "APPLY (gerçek yazım)" : "DRY-RUN (yazma yok)"}\n`);

  // ── AŞAMA 1: Uzlaştırma ──────────────────────────────────────────────────
  const total = await db.runner.count();
  const jockeyNull = await db.runner.count({ where: { jockey: null } });
  const zatenDolu = await db.runner.count({ where: { jockey: { not: null }, tjkJokeyId: { not: null } } });
  const backfillAdayi = await db.runner.count({ where: { jockey: { not: null }, tjkJokeyId: null } });
  console.log("=".repeat(60));
  console.log("AŞAMA 1 — UZLAŞTIRMA");
  console.log("=".repeat(60));
  console.log(`Toplam Runner: ${total}`);
  console.log(`  jockey NULL (ID alamaz): ${jockeyNull}`);
  console.log(`  jockey dolu + tjkJokeyId dolu (zaten forward-capture): ${zatenDolu}`);
  console.log(`  jockey dolu + tjkJokeyId NULL (backfill adayı): ${backfillAdayi}`);
  console.log(`  Kontrol toplamı: ${jockeyNull + zatenDolu + backfillAdayi} (== ${total} olmalı: ${jockeyNull + zatenDolu + backfillAdayi === total ? "✓" : "✗ UYUŞMUYOR"})`);

  // ── AŞAMA 2: Conflict-check (zaten dolu satırlar) ───────────────────────
  console.log(`\n${"=".repeat(60)}`);
  console.log("AŞAMA 2 — CONFLICT-CHECK (zaten tjkJokeyId dolu satırlar)");
  console.log("=".repeat(60));

  const doluRunners = await db.runner.findMany({
    where: { jockey: { not: null }, tjkJokeyId: { not: null } },
    select: {
      id: true, no: true, tjkJokeyId: true, tjkAtId: true,
      race: { select: { raceNo: true, raceDay: { select: { date: true, hippodrome: { select: { name: true, slug: true } } } } } },
    },
  });
  const doluByPair = new Map<string, typeof doluRunners>();
  for (const r of doluRunners) {
    const key = `${r.race.raceDay.date.toISOString().slice(0, 10)}|${r.race.raceDay.hippodrome.slug}`;
    const arr = doluByPair.get(key) ?? [];
    arr.push(r);
    doluByPair.set(key, arr);
  }

  let existingNonNull = 0, sameAsDirect = 0, conflict = 0, cantVerify = 0;
  const conflictSamples: string[] = [];
  await paralelIsle([...doluByPair.entries()], async ([key, runners]) => {
    const [dateIso, hippoSlug] = key.split("|");
    const hippoName = runners[0].race.raceDay.hippodrome.name;
    const pairMap = await fetchPairMap(dateIso, hippoName, hippoSlug);
    for (const r of runners) {
      existingNonNull++;
      if (pairMap === "PAGE_UNAVAILABLE") { cantVerify++; continue; }
      const fetched = pairMap.get(`${r.race.raceNo}|${r.no}`);
      if (!fetched || fetched.tjkJokeyId == null) { cantVerify++; continue; }
      if (fetched.tjkJokeyId === r.tjkJokeyId) { sameAsDirect++; }
      else {
        conflict++;
        conflictSamples.push(`  date=${dateIso} hippo=${hippoName} raceNo=${r.race.raceNo} horseNo=${r.no}: DB=${r.tjkJokeyId} vs sayfa=${fetched.tjkJokeyId}`);
      }
    }
  });
  console.log(`existing_non_null: ${existingNonNull}`);
  console.log(`same_as_direct: ${sameAsDirect}`);
  console.log(`conflict: ${conflict}`);
  console.log(`cant_verify (sayfa/eşleşme yok, hüküm verilemedi): ${cantVerify}`);
  if (conflict > 0) {
    console.log("\nÇAKIŞMA ÖRNEKLERİ:");
    console.log(conflictSamples.join("\n"));
    console.log("\n🛑 CONFLICT > 0 — SCRIPT BURADA DURUYOR. Hiçbir yazma yapılmayacak (AŞAMA 3/4 atlanıyor).");
    await db.$disconnect();
    return;
  }
  console.log("✓ Conflict yok — devam ediliyor.");

  // ── AŞAMA 3: Sınıflandırma (backfill adayları) ──────────────────────────
  console.log(`\n${"=".repeat(60)}`);
  console.log("AŞAMA 3 — SINIFLANDIRMA (backfill adayları)");
  console.log("=".repeat(60));

  const adaylar = await db.runner.findMany({
    where: { jockey: { not: null }, tjkJokeyId: null },
    select: {
      id: true, no: true, tjkAtId: true,
      race: { select: { raceNo: true, raceDay: { select: { date: true, hippodrome: { select: { name: true, slug: true } } } } } },
    },
  });
  const adayByPair = new Map<string, typeof adaylar>();
  for (const r of adaylar) {
    const key = `${r.race.raceDay.date.toISOString().slice(0, 10)}|${r.race.raceDay.hippodrome.slug}`;
    const arr = adayByPair.get(key) ?? [];
    arr.push(r);
    adayByPair.set(key, arr);
  }
  console.log(`Toplam (date,hippodrome) çifti: ${adayByPair.size}, toplam aday satır: ${adaylar.length}`);

  const yazilacaklar: { id: string; tjkJokeyId: number }[] = [];
  let sayfaAlinamadi = 0, eslesmeYok = 0, atIdUyusmazlik = 0;
  const basarisizPairlar: string[] = [];
  let sayacPair = 0;

  await paralelIsle([...adayByPair.entries()], async ([key, runners]) => {
    sayacPair++;
    const [dateIso, hippoSlug] = key.split("|");
    const hippoName = runners[0].race.raceDay.hippodrome.name;
    const pairMap = await fetchPairMap(dateIso, hippoName, hippoSlug);
    if (pairMap === "PAGE_UNAVAILABLE") {
      sayfaAlinamadi += runners.length;
      basarisizPairlar.push(`${dateIso} ${hippoName}: sayfa alınamadı (${runners.length} satır etkilendi)`);
      return;
    }
    for (const r of runners) {
      const fetched = pairMap.get(`${r.race.raceNo}|${r.no}`);
      if (!fetched || fetched.tjkJokeyId == null) { eslesmeYok++; continue; }
      if (r.tjkAtId != null && fetched.tjkAtId != null && r.tjkAtId !== fetched.tjkAtId) { atIdUyusmazlik++; continue; }
      yazilacaklar.push({ id: r.id, tjkJokeyId: fetched.tjkJokeyId });
    }
    if (sayacPair % 50 === 0) console.log(`  ...${sayacPair}/${adayByPair.size} çift işlendi`);
  });

  console.log(`\nSINIFLANDIRMA SONUCU:`);
  console.log(`  YAZILABİLİR (direct-ID + tjkAtId tutarlı/yok): ${yazilacaklar.length}`);
  console.log(`  sayfa alınamadı: ${sayfaAlinamadi}`);
  console.log(`  eşleşme yok (raceNo+no sayfada bulunamadı/ID yok): ${eslesmeYok}`);
  console.log(`  tjkAtId uyuşmazlığı (yazılmadı): ${atIdUyusmazlik}`);
  console.log(`  Kontrol toplamı: ${yazilacaklar.length + sayfaAlinamadi + eslesmeYok + atIdUyusmazlik} (== ${adaylar.length} olmalı)`);
  if (basarisizPairlar.length > 0) {
    console.log(`\nBaşarısız sayfa çiftleri (${basarisizPairlar.length}):`);
    console.log(basarisizPairlar.join("\n"));
  }

  // ── AŞAMA 4: Yazım (yalnız --apply) ──────────────────────────────────────
  console.log(`\n${"=".repeat(60)}`);
  console.log(`AŞAMA 4 — ${APPLY ? "YAZIM" : "YAZIM ATLANDI (dry-run)"}`);
  console.log("=".repeat(60));
  if (!APPLY) {
    console.log(`APPLY=1 ile çalıştırılırsa ${yazilacaklar.length} satır yazılacak.`);
    await db.$disconnect();
    return;
  }

  let toplamGuncellenen = 0;
  for (let i = 0; i < yazilacaklar.length; i += CHUNK_BOYUTU) {
    const chunk = yazilacaklar.slice(i, i + CHUNK_BOYUTU);
    // Bulk UPDATE...FROM(VALUES...) — tek round-trip/chunk (önceki 500-ayrı-updateMany
    // deseni satır başına network gecikmesi yüzünden çok yavaştı, bkz. dosya başı not).
    // WHERE r."tjkJokeyId" IS NULL idempotency guard'ı AYNEN korunuyor.
    const values = Prisma.join(
      chunk.map((item) => Prisma.sql`(${item.id}::text, ${item.tjkJokeyId}::integer)`),
      ", "
    );
    const chunkGuncellenen: number = await db.$executeRaw`
      UPDATE "Runner" AS r
      SET "tjkJokeyId" = v.newid
      FROM (VALUES ${values}) AS v(id, newid)
      WHERE r.id = v.id AND r."tjkJokeyId" IS NULL
    `;
    toplamGuncellenen += chunkGuncellenen;
    console.log(`  chunk ${Math.floor(i / CHUNK_BOYUTU) + 1}: ${chunk.length} satır denendi, ${chunkGuncellenen} güncellendi (toplam: ${toplamGuncellenen})`);
  }
  console.log(`\nTOPLAM GÜNCELLENEN: ${toplamGuncellenen} / ${yazilacaklar.length} aday`);

  const totalSonra = await db.runner.count();
  console.log(`Runner satır sayısı: ${total} -> ${totalSonra} (${total === totalSonra ? "✓ değişmedi" : "✗ DEĞİŞTİ"})`);

  await db.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
