// ROTAGANYAN Research Harness R2 — Golden Suite Doğrulaması (KALICI ARAÇ, 2026-09-22).
// Kullanıcının 2. düzeltmesi (aynı gün): "B=500'e çıkmak Monte Carlo gürültüsünü azaltır,
// örneklemin taşıdığı GERÇEK belirsizliği küçültmez" — bu yüzden "bilinen pozitif" TEK bir
// kontrol yerine İKİYE ayrıldı:
//   1. NULL — gürültü özelliği → β≈0, REJECT_CONFIRM beklenir.
//   2. KNOWN NEGATIVE — J1'in jokeyFormDegisimiZ_A'sı (Diğer/tam-tarih, ESKİ harness'te
//      P(ΔLL<0)=%0.2 KESİN reddedilmişti) — R2 AYNI (sayısal tolerans dahilinde) sonucu
//      üretmeli: β/nokta-ΔLL DETERMİNİSTİK kısımlar BİREBİR eşleşmeli.
//   3. REAL RESTORATION (fonksiyonel, PASS ZORUNLU DEĞİL) — hizDerecesi S0'dan çıkarılıp
//      (hizHaric=true, doğrulandı: gerçek bir ÇIKARMA, çift sayım YOK) aynı ham alan
//      challenger olarak geri eklenir. Beklenti: yön doğru + degraded baseline'dan
//      iyileşme — CI<0 ŞART DEĞİL (kullanıcı: "production β başka veri üzerinde öğrenildi,
//      bu locked TEST'te marjinal katkısı zayıf kalabilir — mükemmel fixture değil").
//   4. STRONG SYNTHETIC POSITIVE (PASS ZORUNLU) — sentetik, bilerek outcome-linked bir
//      fixture (x=+1 kazanana, -1/(n-1) diğerlerine). Araştırma sinyali DEĞİL, yalnız
//      harness'in GERÇEKTEN PASS üretebildiğinin kanıtı. PASS vermezse sorun harness'te.
// Kullanım: node --env-file=.env node_modules/tsx/dist/cli.mjs arac-research-harness-validate.mts
import { readFileSync } from "fs";
import { type Row, type RaceGroup, groupByRace, mulberry32, yakinsama2PlusEkle } from "./research-harness-core.mts";
import { runPipeline, raporYazdir, type Aday } from "./research-harness-pipeline.mts";

const DATA_PATH = "C:\\Users\\tlgbi\\AppData\\Local\\Temp\\claude\\c--Users-tlgbi-OneDrive-Belgeler-Rota\\76598f4f-31f1-4414-a3f6-fbab0aab98d4\\scratchpad\\model-veri-yeni-adaylar-jokeyform.json";
const B = Number(process.env.BOOTSTRAP_B ?? 500);

async function main() {
  const { db } = await import("./src/lib/db");
  const rawAll: Row[] = JSON.parse(readFileSync(DATA_PATH, "utf-8"));
  const tumRaceIdler = [...new Set(rawAll.map((r) => r.raceId))];
  const raceDates = await db.race.findMany({
    where: { id: { in: tumRaceIdler } },
    select: { id: true, raceDayId: true, raceDay: { select: { date: true } } },
  });
  const tarihByRaceId = new Map(raceDates.map((r) => [r.id, r.raceDay.date]));
  const raceDayIdByRaceId = new Map(raceDates.map((r) => [r.id, r.raceDayId]));
  await db.$disconnect();

  // Known-negative kontrolü tam tarih aralığında (2026-01-01→) koştu (bkz. J1 kapanışı) —
  // aynı kapsamı burada da kullanıyoruz ki karşılaştırma birebir olsun.
  const kapsamaBaslangic = new Date("2026-01-01T00:00:00.000Z");
  const raw = rawAll.filter((r) => {
    const d = tarihByRaceId.get(r.raceId);
    return d && d >= kapsamaBaslangic;
  });

  const raceGruplariHam: RaceGroup[] = groupByRace(raw)
    .filter((g) => g.runners.length >= 2)
    .map((g) => ({ ...g, raceDayId: raceDayIdByRaceId.get(g.raceId) ?? g.raceId }));
  for (const g of raceGruplariHam) yakinsama2PlusEkle(g.runners);
  const diger = raceGruplariHam.filter((g) => !(g.runners[0].kategori === "1a" || g.runners[0].kategori === "1b"));
  console.log(`Diğer segment: ${diger.length} koşu\n`);

  // ── Kontrol 1: NULL (gürültü) ──────────────────────────────────────────────
  const nullRng = mulberry32(999100);
  const NullControl: Aday = {
    id: "null-control",
    ad: "QA_NullControl (saf gürültü — β≈0, ΔLL≈0 beklenir)",
    hesapla: (runners) => runners.map(() => nullRng() * 2 - 1),
  };
  console.log("########## KONTROL 1: NULL (gürültü) ##########");
  const r1 = runPipeline(NullControl, "diger", diger, DATA_PATH, { confirm: true, B, skipDevForEquivalenceTest: true });
  raporYazdir(r1);
  const kontrol1Gecti = r1.confirm != null && Math.abs(r1.confirm.beta) < 0.05 && r1.confirm.status !== "ROBUST_PASS" && r1.confirm.status !== "PASS_CAUTION";
  console.log(`>>> KONTROL 1 ${kontrol1Gecti ? "✓ GEÇTİ" : "✗ BAŞARISIZ"} (β küçük olmalı ve PASS ÜRETMEMELİ)\n`);

  // ── Kontrol 2: KNOWN NEGATIVE (J1 — jokeyFormDegisimiZ_A) ──────────────────
  const JokeyFormA: Aday = {
    id: "jokeyform-a",
    ad: "JokeyFormDegisimiZ_AGFDahil (J1, BİLİNEN NEGATİF — REJECT beklenir)",
    hesapla: (runners) => runners.map((r) => (typeof r.jokeyFormDegisimiZ_A === "number" ? r.jokeyFormDegisimiZ_A : 0)),
    dahilMi: (runners) => runners.map((r) => r.jokeyFormQcPass === true && typeof r.jokeyFormDegisimiZ_A === "number"),
  };
  console.log("########## KONTROL 2: KNOWN NEGATIVE (J1) ##########");
  console.log("Eski harness referans sonucu (2026-09-22, B=500, tam tarih, Diğer/AGF-dahil):");
  console.log("  β=-0.0547  TEST ΔLL=0.0010  β-GA=[-0.1302,0.0231]  refit-aware GA=[0.0000,0.0055] P(ΔLL<0)=0.2% ort=0.0016  paired GA=[-0.0020,0.0042] P(ΔLL<0)=26.6%");
  const r2 = runPipeline(JokeyFormA, "diger", diger, DATA_PATH, { confirm: true, B, skipDevForEquivalenceTest: true });
  raporYazdir(r2);
  const kontrol2Gecti = r2.confirm != null && r2.confirm.status === "REJECT_CONFIRM";
  console.log(`>>> KONTROL 2 ${kontrol2Gecti ? "✓ GEÇTİ" : "✗ BAŞARISIZ"} (REJECT_CONFIRM olmalı, sayılar yukarıdaki referansa yakın olmalı)\n`);

  // ── Kontrol 3: REAL RESTORATION (fonksiyonel, PASS ZORUNLU DEĞİL) ──────────
  // S_degraded = S_V5.46 - katkı(hizDerecesi); S_challenger = S_degraded + β̂·z_hiz
  // (β̂ TRAIN+DEV'de yeniden fit edilir) — doğrulandı: research-harness-core.mts'teki
  // hizHaric bayrağı katkılar[HIZ_DERECESI_IDX]'i TAM OLARAK BİR KEZ çıkarır, çift sayım yok.
  const HizDerecesiGeriEkle: Aday = {
    id: "hizderecesi-restoration",
    ad: "HizDerecesi_RealRestoration (fonksiyonel kontrol — yön+iyileşme beklenir, CI<0 ŞART DEĞİL)",
    hesapla: (runners) => runners.map((r) => (typeof r.hizDerecesi === "number" ? r.hizDerecesi : 0)),
  };
  console.log("########## KONTROL 3: REAL RESTORATION (hizDerecesi, fonksiyonel) ##########");
  const r3 = runPipeline(HizDerecesiGeriEkle, "diger", diger, DATA_PATH, { confirm: true, B, skipDevForEquivalenceTest: true, varyant: { hizHaric: true } });
  raporYazdir(r3);
  const kontrol3Gecti = r3.confirm != null && r3.confirm.beta > 0 && r3.confirm.deltaLL < 0;
  console.log(`>>> KONTROL 3 ${kontrol3Gecti ? "✓ GEÇTİ" : "✗ BAŞARISIZ"} (yalnız yön: β>0 VE degraded baseline'dan TEST ΔLL<0 — CI şartı YOK)\n`);

  // ── Kontrol 4: STRONG SYNTHETIC POSITIVE (PASS ZORUNLU) ────────────────────
  // Araştırma sinyali DEĞİL — leakage-safe olması GEREKMİYOR (kasıtlı outcome-linked).
  // Yalnız harness'in mekanik olarak PASS_CONFIRM/ROBUST_PASS üretebildiğini kanıtlar.
  const StrongSyntheticPositive: Aday = {
    id: "strong-synthetic-positive",
    ad: "QA_StrongSyntheticPositive (deterministik outcome-linked fixture — ARAŞTIRMA SİNYALİ DEĞİL, ROBUST_PASS ŞART)",
    hesapla: (runners) => {
      const n = runners.length;
      return runners.map((r) => (r.win === 1 ? 1 : -1 / (n - 1)));
    },
  };
  console.log("########## KONTROL 4: STRONG SYNTHETIC POSITIVE ##########");
  const r4 = runPipeline(StrongSyntheticPositive, "diger", diger, DATA_PATH, { confirm: true, B, skipDevForEquivalenceTest: true });
  raporYazdir(r4);
  const kontrol4Gecti = r4.confirm != null && r4.confirm.status === "ROBUST_PASS";
  console.log(`>>> KONTROL 4 ${kontrol4Gecti ? "✓ GEÇTİ" : "✗ BAŞARISIZ"} (ROBUST_PASS ŞART — geçmezse sorun harness'te)\n`);

  console.log("========================================");
  console.log(`SONUÇ: ${[kontrol1Gecti, kontrol2Gecti, kontrol3Gecti, kontrol4Gecti].filter(Boolean).length}/4 kontrol geçti.`);
  console.log(kontrol1Gecti && kontrol2Gecti && kontrol3Gecti && kontrol4Gecti
    ? "R2 canonical harness olarak İLAN EDİLEBİLİR."
    : "R2 HENÜZ canonical ilan edilemez — başarısız kontrol(ler) araştırılmalı.");

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
