// KALICI ARAÇ (2026-09-21) — "Sürpriz Katmanı" Faz H2: Race Context Change ailesinin ilk
// (ve kullanıcı önceliğine göre en temiz) adayı — ClassDeltaV1.
//
// Kullanıcı tasarımı: ClassDeltaV1 = PrevClassStrength - CurrentClassStrength, YALNIZ AYNI
// sınıf AİLESİ içinde (Şartlı→Şartlı veya Handikap→Handikap) hesaplanır — Maiden→Şartlı,
// Satış→Handikap gibi AİLELER ARASI karşılaştırma v1'de YAPILMAZ (M=0). Strength = classType
// metnindeki HAM SAYI (Şartlı 5→4: +1, Şartlı 3→5: -2, Handikap 17→15: +2 — kullanıcının
// verdiği örnekler HAM SAYI farkıyla BİREBİR eşleşiyor, mevcut classToSkk piramidi
// KULLANILMIYOR çünkü o Handikap'ı yalnız 2 kaba dilime sıkıştırıyor, bu v1'in istediği
// hassasiyeti taşımıyor). Pozitif = bugün daha KOLAY sınıfa iniyor.
//
// Yalnız atın SON UYGUN geçmiş start'ı kullanılır (son 3 ortalaması DEĞİL — kullanıcı: "ilk
// versiyonu dar tutalım"), hedef yarış tarihinden KESİNLİKLE önce (leak-free). Accurace YOK
// — yalnız kendi Runner/Race tablomuzdan (isim eşleşmesi, HorseHistoryCache/Accurace'e göre
// çok daha ucuz bir sorgu).
import { readFileSync, writeFileSync } from "fs";
import { db } from "./src/lib/db";

const IN_PATH =
  "C:\\Users\\tlgbi\\AppData\\Local\\Temp\\claude\\c--Users-tlgbi-OneDrive-Belgeler-Rota\\76598f4f-31f1-4414-a3f6-fbab0aab98d4\\scratchpad\\model-veri-yeni-adaylar-hiddenperf.json";
const OUT_PATH =
  "C:\\Users\\tlgbi\\AppData\\Local\\Temp\\claude\\c--Users-tlgbi-OneDrive-Belgeler-Rota\\76598f4f-31f1-4414-a3f6-fbab0aab98d4\\scratchpad\\model-veri-yeni-adaylar-classdeltav1.json";
const COVERAGE_START_DATE = "2026-08-16"; // bkz. feedback_backtest_kapsami_v5_baslangici

type RowIn = { raceId: string; runnerId: string; no: number; [k: string]: unknown };

function siniflandirmaAilesi(classType: string | null | undefined): "SARTLI" | "HANDIKAP" | null {
  if (!classType) return null;
  const t = classType.toUpperCase();
  if (/HAND[İI]KAP/.test(t)) return "HANDIKAP";
  if (/[ŞS]ARTLI/.test(t)) return "SARTLI";
  return null; // Maiden/Satış/G1-G3/KV/vb. — v1'de M=0
}
function siniflandirmaSayisi(classType: string | null | undefined): number | null {
  if (!classType) return null;
  const m = classType.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

async function main() {
  const rows: RowIn[] = JSON.parse(readFileSync(IN_PATH, "utf-8"));
  const raceIds = [...new Set(rows.map((r) => r.raceId))];
  console.log(`${rows.length} satır, ${raceIds.length} koşu.`);

  const races = await db.race.findMany({
    where: { id: { in: raceIds } },
    select: { id: true, classType: true, raceDay: { select: { date: true } } },
  });
  const raceInfoById = new Map(races.map((r) => [r.id, { date: r.raceDay.date, classType: r.classType }]));

  const kapsamaBaslangic = new Date(COVERAGE_START_DATE + "T00:00:00.000Z");
  const kapsamdakiRowlar = rows.filter((r) => {
    const info = raceInfoById.get(r.raceId);
    return info != null && info.date >= kapsamaBaslangic;
  });
  console.log(`Kapsam filtresi (>=${COVERAGE_START_DATE}): ${kapsamdakiRowlar.length}/${rows.length} satır işlenecek.`);

  const runnerIds = [...new Set(kapsamdakiRowlar.map((r) => r.runnerId))];
  const nameByRunnerId = new Map<string, string>();
  const CHUNK = 3000;
  for (let i = 0; i < runnerIds.length; i += CHUNK) {
    const dilim = runnerIds.slice(i, i + CHUNK);
    const runners = await db.runner.findMany({ where: { id: { in: dilim } }, select: { id: true, name: true } });
    for (const r of runners) nameByRunnerId.set(r.id, r.name);
  }

  // TÜM ilgili atların TÜM geçmişini (herhangi bir tarihte, herhangi bir hipodromda) TEK
  // seferde çek — isim eşleştirme (bu projede TJK/Runner isimleri normalize edilmeden de
  // yeterince tutarlı, bkz. diğer backfill'lerin çoğu normalizeHorseName kullanıyor —
  // burada da AYNI güvenlik için kullanılacak).
  const { normalizeHorseName } = await import("./src/lib/methodology/veri-toplama");
  const tumIsimler = [...new Set([...nameByRunnerId.values()])];
  console.log(`${tumIsimler.length} benzersiz at ismi — tüm geçmiş start'lar çekiliyor...`);

  type GecmisKayit = { date: Date; classType: string | null };
  const gecmisByNorm = new Map<string, GecmisKayit[]>();
  const NAME_CHUNK = 500;
  for (let i = 0; i < tumIsimler.length; i += NAME_CHUNK) {
    const dilim = tumIsimler.slice(i, i + NAME_CHUNK);
    const kayitlar = await db.runner.findMany({
      where: { name: { in: dilim } },
      select: { name: true, race: { select: { classType: true, raceDay: { select: { date: true } } } } },
    });
    for (const k of kayitlar) {
      const norm = normalizeHorseName(k.name);
      const arr = gecmisByNorm.get(norm) ?? [];
      arr.push({ date: k.race.raceDay.date, classType: k.race.classType });
      gecmisByNorm.set(norm, arr);
    }
    console.log(`  ${Math.min(i + NAME_CHUNK, tumIsimler.length)}/${tumIsimler.length} isim işlendi...`);
  }
  await db.$disconnect();
  for (const arr of gecmisByNorm.values()) arr.sort((a, b) => b.date.getTime() - a.date.getTime());

  const classDeltaByRunnerId = new Map<string, number | null>();
  for (const row of kapsamdakiRowlar) {
    const name = nameByRunnerId.get(row.runnerId);
    const info = raceInfoById.get(row.raceId);
    if (!name || !info) { classDeltaByRunnerId.set(row.runnerId, null); continue; }
    const buguninAilesi = siniflandirmaAilesi(info.classType);
    const buguninSayisi = siniflandirmaSayisi(info.classType);
    if (!buguninAilesi || buguninSayisi == null) { classDeltaByRunnerId.set(row.runnerId, null); continue; }

    const gecmis = gecmisByNorm.get(normalizeHorseName(name)) ?? [];
    // Son uygun geçmiş start: hedef tarihten KESİNLİKLE önceki İLK (en yeni) kayıt.
    const sonStart = gecmis.find((g) => g.date.getTime() < info.date.getTime());
    if (!sonStart) { classDeltaByRunnerId.set(row.runnerId, null); continue; }
    const sonAile = siniflandirmaAilesi(sonStart.classType);
    const sonSayi = siniflandirmaSayisi(sonStart.classType);
    if (sonAile !== buguninAilesi || sonSayi == null) { classDeltaByRunnerId.set(row.runnerId, null); continue; } // M=0

    classDeltaByRunnerId.set(row.runnerId, sonSayi - buguninSayisi);
  }

  const zenginlestirilmis = rows.map((r) => {
    const cd = classDeltaByRunnerId.get(r.runnerId) ?? null;
    return { ...r, classDeltaV1: cd, classDeltaV1VarMi: cd != null };
  });
  const dolu = zenginlestirilmis.filter((r) => r.classDeltaV1VarMi).length;
  console.log(`Toplam ${rows.length} satır — classDeltaV1 dolu: ${dolu} (%${((100 * dolu) / rows.length).toFixed(1)})`);
  writeFileSync(OUT_PATH, JSON.stringify(zenginlestirilmis));
  console.log(`Yazıldı: ${OUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
