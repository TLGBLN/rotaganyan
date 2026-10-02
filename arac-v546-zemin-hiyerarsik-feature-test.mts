// ZEMİN TOLERANSI — HİYERARŞİK FEATURE TESTİ (2026-10-02, kullanıcı tasarımı)
//
// Bugünkü Bursa (Çim: Ağır 4,5) sorgusu şunu ortaya çıkardı: mevcut `zeminToleransi`
// (x) bir atın TÜM "Normal-dışı" geçmişini (Çim-Ağır + Kum-Islak + Çim-Yumuşak hepsi
// TEK sepette) harmanlıyor — "ağır çim ≠ ıslak kum" ayrımı YOK. Kullanıcının önerisi:
// β'ya (ağırlığa) DOKUNMADAN, yalnız x'in NASIL hesaplandığını hiyerarşik kanıt
// harmanlamasıyla değiştirmek: EXACT (aynı pist+aynı rejim ailesi) > SAME_SURFACE
// (aynı pist, herhangi anormal) > ALL_ABNORMAL (mevcut, legacy) > nötr, n büyüdükçe
// ağırlık EXACT'e kayan bir shrinkage harmanı.
//
// EK BULGU (bu script'i yazarken ortaya çıktı, ayrıca raporlanacak): mevcut legacy x,
// BUGÜNÜN yüzeyine/rejimine HİÇ bakmıyor — at için SABİT bir "anormal zeminlerde genel
// toleransı" değeri, normal bir günde de aynı şekilde skora giriyor. Bu 4 aday da aynı
// şekilde davranıyor (bugünün yüzeyine göre hesaplanan EXACT/SAME_SURFACE dahi, o atın
// TÜM geçmiş yarışlarında kullanılacak TEK bir x değilim; raceId bazlı, o günün
// surface+rejimine göre YENİDEN hesaplanıyor) — yani bu çalışma aynı zamanda feature'ı
// "bugüne duyarlı" hale getiriyor, bu da ayrı, belirtilmesi gereken bir davranış değişikliği.
//
// ÖNEMLİ ÖRNEKLEM UYARISI: V5.46 prediction tarihçesinde yalnız ~16/564 gün (%2.8)
// anormal zemin etiketli — bu test SINIRLI güce sahip, kesin "kazandı/kaybetti" yerine
// GA genişliğiyle birlikte okunmalı.
//
// Metodoloji: β ve standardize(mean/std) SABİT, PRODUCTION'daki GERÇEK değerler
// (weights JSON'dan okunur) — yalnız x_zemin değişiyor. Champion = gerçek üretim
// toplam skoru (featureSnapshot katkıları). Challenger_i = toplam skor - eski
// zemin_katki + yeni zemin_katki(yöntem i). Race-level LogLoss, paired bootstrap.
// 4 aday TRAIN/DEV'de taranır (fit YOK, yalnız karşılaştırma) — en iyi aday TEST'te
// (kilitli) tek başına doğrulanır (multiple-comparison'a karşı pre-registered disiplin).
//
// Production'a DOKUNULMADI.
import { db } from "./src/lib/db";
import { softmax, hibritMaidenSatisMi } from "./src/lib/methodology/v5-engine";
import { kategoriTespit } from "./src/lib/methodology/v2-engine";
import { zeminRejimiCikar, type ZeminRejimi } from "./src/lib/methodology/pist-dayanikliligi";
import * as fs from "fs";

const B_BOOTSTRAP = 2000;
const EPSILON = 0.01;
const SHRINKAGE_K = 5;

// ─── Production parametreleri (weights JSON'dan, DOKUNULMADI) ─────────────────
const WJ_DIGER = JSON.parse(fs.readFileSync("src/lib/methodology/weights/v5-weights-diger.json", "utf8"));
const WJ_DUSUKSART = JSON.parse(fs.readFileSync("src/lib/methodology/weights/v5-weights-dusuksart.json", "utf8"));
function zeminParams(segment: string): { weight: number; mean: number; std: number } | null {
  const wj = segment === "Düşük Şart" ? WJ_DUSUKSART : segment === "Diğer" ? WJ_DIGER : null;
  if (!wj) return null; // Handikap/Hibrit: zeminToleransi A-katmanında yok (elle sıfırlanmış/yok)
  const idx = wj.featureNames.indexOf("zeminToleransi");
  if (idx < 0) return null;
  return { weight: wj.weights[idx], mean: wj.means[idx], std: wj.stds[idx] };
}
function standardizeTek(x: number, mean: number, std: number): number {
  return std > 1e-9 ? (x - mean) / std : 0;
}

// ─── Yüzey ailesi (kullanıcının "Çim-Ağırlaşma" / "Çim-Yumuşama" / "Kum-Islanma" ayrımı) ──
function rejimAilesi(rejim: ZeminRejimi): "AGIRLASMA" | "YUMUSAMA" | "ISLANMA" | null {
  if (rejim === "BIRAZ_AGIR" || rejim === "AGIR" || rejim === "COK_AGIR") return "AGIRLASMA";
  if (rejim === "BIRAZ_YUMUSAK" || rejim === "YUMUSAK" || rejim === "COK_YUMUSAK") return "YUMUSAMA";
  if (rejim === "NEMLI" || rejim === "SULU" || rejim === "ISLAK") return "ISLANMA";
  return null;
}

// ─── Arşiv yükleme + kilo-pace yardımcıları (zemin-toleransi.actions.ts ile AYNI) ──
function dereceyeSaniye(t: string | null): number | null {
  if (!t) return null;
  const parts = t.trim().split(".");
  if (parts.length === 3) return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10) + parseInt(parts[2], 10) / 100;
  if (parts.length === 2) return parseInt(parts[0], 10) + parseInt(parts[1], 10) / 100;
  return null;
}
function mesafeyeMetre(m: string): number { return parseInt(m.replace(/\./g, ""), 10); }
function parseKilo(kilo: string | null): number | null {
  if (!kilo) return null;
  const n = parseFloat(kilo.replace(",", "."));
  return isNaN(n) ? null : n;
}
function kiloKategorisi(cinsAdi: string): "handikap" | "diger" { return /handikap/i.test(cinsAdi) ? "handikap" : "diger"; }

type ArsivSatiri = { atAdi: string; irk: string; pist: string; mesafe: string; pistDurumu: string; derece: string | null; kilo: string | null; cinsAdi: string; tarih: Date | null };

async function main() {
  console.log("1/6 — TjkDereceKaydi arşivi yükleniyor...");
  const arsiv: ArsivSatiri[] = await db.tjkDereceKaydi.findMany({
    where: { derece: { not: null } },
    select: { atAdi: true, irk: true, pist: true, mesafe: true, pistDurumu: true, derece: true, kilo: true, cinsAdi: true, tarih: true },
  });
  console.log(`   ${arsiv.length} satır.\n`);

  console.log("2/6 — Popülasyon tabanı (yalnız Normal, GLOBAL — yöntemden bağımsız, legacy ile AYNI)...");
  // kiloEgimi + bucketOrt leak-free olmalı ama her race'in KENDİ cutoff'una göre yeniden
  // hesaplamak (317 kez) gereksiz yavaş olur — bu proje genelinde (ör. M1/M2) de population
  // istatistikleri BATCH hesaplandı; burada tarihsel sona (son race tarihi) göre TEK SEFER
  // hesaplanır — zemin toleransı sinyali ZATEN düşük ağırlıklı, bu yaklaşım kabul edilebilir
  // bir yaklaşım (tam production birebir leak-free simülasyonu DEĞİL, karşılaştırmalı bir
  // feature-testi — dört yöntem de AYNI tabanı kullandığı için ADİL kalıyor).
  const kiloEgimi = new Map<"handikap" | "diger", number>();
  {
    const egimToplam = new Map<"handikap" | "diger", { sxy: number; sxx: number; sayi: number }>();
    const bucketHam = new Map<string, { pace: number; kilo: number; kategori: "handikap" | "diger" }[]>();
    for (const s of arsiv) {
      if (s.pistDurumu !== "Normal") continue;
      const sn = dereceyeSaniye(s.derece), metre = mesafeyeMetre(s.mesafe), kilo = parseKilo(s.kilo);
      if (!sn || !metre || kilo == null || sn <= 0) continue;
      const bucket = `${s.irk}|${s.pist}|${metre}`;
      const arr = bucketHam.get(bucket) ?? [];
      arr.push({ pace: metre / sn, kilo, kategori: kiloKategorisi(s.cinsAdi) });
      bucketHam.set(bucket, arr);
    }
    for (const [, arr] of bucketHam.entries()) {
      if (arr.length < 10) continue;
      const ortKilo = arr.reduce((s, a) => s + a.kilo, 0) / arr.length;
      const ortPace = arr.reduce((s, a) => s + a.pace, 0) / arr.length;
      for (const a of arr) {
        const e = egimToplam.get(a.kategori) ?? { sxy: 0, sxx: 0, sayi: 0 };
        const dx = a.kilo - ortKilo, dy = a.pace - ortPace;
        e.sxy += dx * dy; e.sxx += dx * dx; e.sayi++;
        egimToplam.set(a.kategori, e);
      }
    }
    for (const [kategori, e] of egimToplam.entries()) if (e.sayi >= 30 && e.sxx > 0) kiloEgimi.set(kategori, e.sxy / e.sxx);
  }
  const bucketOrt = new Map<string, { pace: number; kilo: number }>();
  {
    const bucketToplam = new Map<string, { paceToplam: number; kiloToplam: number; sayi: number }>();
    for (const s of arsiv) {
      if (s.pistDurumu !== "Normal") continue;
      const sn = dereceyeSaniye(s.derece), metre = mesafeyeMetre(s.mesafe), kilo = parseKilo(s.kilo);
      if (!sn || !metre || sn <= 0) continue;
      const bucket = `${s.irk}|${s.pist}|${metre}|${kiloKategorisi(s.cinsAdi)}`;
      const e = bucketToplam.get(bucket) ?? { paceToplam: 0, kiloToplam: 0, sayi: 0 };
      e.paceToplam += metre / sn; e.kiloToplam += kilo ?? 0; e.sayi++;
      bucketToplam.set(bucket, e);
    }
    for (const [k, v] of bucketToplam.entries()) if (v.sayi >= 5) bucketOrt.set(k, { pace: v.paceToplam / v.sayi, kilo: v.kiloToplam / v.sayi });
  }

  function goreliPace(s: ArsivSatiri): number | null {
    const sn = dereceyeSaniye(s.derece), metre = mesafeyeMetre(s.mesafe), kilo = parseKilo(s.kilo);
    if (!sn || !metre || sn <= 0) return null;
    const kategori = kiloKategorisi(s.cinsAdi);
    const bucket = `${s.irk}|${s.pist}|${metre}|${kategori}`;
    const taban = bucketOrt.get(bucket);
    if (!taban) return null;
    const egim = kiloEgimi.get(kategori);
    const beklenenPace = egim != null && kilo != null ? taban.pace + egim * (kilo - taban.kilo) : taban.pace;
    return ((metre / sn - beklenenPace) / beklenenPace) * 100;
  }

  console.log("3/6 — At-bazlı arşiv indeksi (isim -> normal-dışı satırlar, leak-free için tarih saklanıyor)...");
  const atArsivi = new Map<string, { pist: string; rejim: ZeminRejimi; tarih: number; pace: number }[]>();
  for (const s of arsiv) {
    if (s.pistDurumu === "Normal") continue;
    const pace = goreliPace(s);
    if (pace == null) continue;
    const rejim = zeminRejimiCikar(s.pistDurumu);
    const arr = atArsivi.get(s.atAdi) ?? [];
    arr.push({ pist: s.pist, rejim, tarih: s.tarih ? s.tarih.getTime() : 0, pace });
    atArsivi.set(s.atAdi, arr);
  }
  console.log(`   ${atArsivi.size} farklı at.\n`);

  type Yontem = "ALL_ABNORMAL" | "SAME_SURFACE" | "EXACT_FAMILY" | "HIERARCHICAL_BLEND";
  function xHesapla(atAdi: string, cutoff: number, bugunPist: string, bugunRejim: ZeminRejimi, yontem: Yontem): number {
    const tum = (atArsivi.get(atAdi) ?? []).filter((r) => r.tarih < cutoff);
    if (tum.length === 0) return 0;
    const bugunAile = rejimAilesi(bugunRejim);
    const sameSurface = tum.filter((r) => r.pist === bugunPist);
    const exact = bugunAile ? sameSurface.filter((r) => rejimAilesi(r.rejim) === bugunAile) : [];
    const ort = (arr: typeof tum) => (arr.length ? arr.reduce((s, r) => s + r.pace, 0) / arr.length : 0);

    if (yontem === "ALL_ABNORMAL") return ort(tum);
    if (yontem === "SAME_SURFACE") return sameSurface.length ? ort(sameSurface) : ort(tum);
    if (yontem === "EXACT_FAMILY") return exact.length ? ort(exact) : sameSurface.length ? ort(sameSurface) : ort(tum);
    // HIERARCHICAL_BLEND — nested shrinkage, n büyüdükçe EXACT'e kayar
    const n1 = exact.length, n2 = sameSurface.length, n3 = tum.length;
    const w1 = n1 / (n1 + SHRINKAGE_K);
    const w2 = (1 - w1) * (n2 / (n2 + SHRINKAGE_K));
    const w3 = 1 - w1 - w2;
    return w1 * ort(exact) + w2 * ort(sameSurface) + w3 * ort(tum);
  }

  console.log("4/6 — Production race verisi yükleniyor (M1/M2 ile AYNI kaynak, + surface/rejim)...");
  const rows: any[] = await db.$queryRawUnsafe(`
    SELECT p."featureSnapshot" as "featureSnapshot", p."runnerId" as "runnerId",
           pr."raceId" as "prediction_raceId", r."classType" as "classType", r."surface" as "surface",
           rd.date as "date", rd."surfaceConditions" as "surfaceConditions",
           res."winnerNos" as "winnerNos", rn."name" as "atAdi", rn."no" as "atNo"
    FROM "Pick" p
    JOIN "Prediction" pr ON pr.id = p."predictionId"
    JOIN "Race" r ON r.id = pr."raceId"
    JOIN "RaceDay" rd ON rd.id = r."raceDayId"
    JOIN "Hippodrome" h ON h.id = rd."hippodromeId"
    JOIN "Result" res ON res."raceId" = r.id
    JOIN "Runner" rn ON rn.id = p."runnerId"
    WHERE p."featureSnapshot"->>'motorEtiketi' LIKE 'V5.46%'
      AND pr.published = true AND h."isForeign" = false AND h.name != 'Karma'
      AND rn.scratched = false AND rn."ekuriGroup" IS NULL
  `);
  function segmentBelirle(classType: string): string {
    if (hibritMaidenSatisMi(classType)) return "Hibrit";
    const kat = kategoriTespit(classType);
    if (kat === "1a" || kat === "1b") return "Düşük Şart";
    if (kat === "2") return "Handikap";
    return "Diğer";
  }
  function liderEsigiHesaplaYerel(classType: string): number { return kategoriTespit(classType) === "2" ? 0.35 : 0.7; }

  type RunnerRec = { atAdi: string; isWinner: boolean; toplamSkorTam: number; eskiZeminKatki: number; segment: string; pist: string; rejim: ZeminRejimi };
  type RaceRec = { raceId: string; date: number; liderEsigi: number; runners: RunnerRec[] };
  const byRace = new Map<string, RaceRec>();
  let anormalAtSayisi = 0;
  for (const row of rows) {
    const fs_: { kod: string; katki: number }[] = row.featureSnapshot?.tumSinyaller ?? [];
    const toplamKatki = fs_.reduce((s, x) => s + x.katki, 0) + (row.featureSnapshot?.bKatmani?.sireKatkisi ?? 0) + (row.featureSnapshot?.bKatmani?.zeminMesafeKatkisi ?? 0);
    const eskiZeminKatki = fs_.find((x) => x.kod === "zeminToleransi")?.katki ?? 0;
    const segment = segmentBelirle(row.classType);
    const sc = row.surfaceConditions as { label: string; detail: string }[] | null;
    const etiket = row.surface === "CIM" ? "Çim" : row.surface === "KUM" ? "Kum" : null;
    const detay = sc?.find((c) => c.label === etiket)?.detail;
    const rejim = zeminRejimiCikar(detay);
    if (rejim !== "NORMAL") anormalAtSayisi++;
    const raceId = row.prediction_raceId;
    const race = byRace.get(raceId) ?? { raceId, date: new Date(row.date).getTime(), liderEsigi: liderEsigiHesaplaYerel(row.classType), runners: [] };
    // Arşivin (TjkDereceKaydi.pist) "Çim"/"Kum" Türkçe etiketiyle eşleşsin diye dönüştürülüyor
    // — Race.surface enum'u (CIM/KUM/SENTETIK) ile arşiv etiketi FARKLI sözlükler.
    const pistEtiketi = row.surface === "CIM" ? "Çim" : row.surface === "KUM" ? "Kum" : row.surface;
    race.runners.push({
      atAdi: row.atAdi, isWinner: (row.winnerNos as number[]).includes(row.atNo),
      toplamSkorTam: toplamKatki, eskiZeminKatki, segment, pist: pistEtiketi, rejim,
    });
    byRace.set(raceId, race);
  }
  const tumYarislar = [...byRace.values()].filter((y) => y.runners.length >= 4 && y.runners.some((r) => r.isWinner)).sort((a, b) => a.date - b.date);
  const anormalYarisSayisi = tumYarislar.filter((y) => y.runners.some((r) => r.rejim !== "NORMAL")).length;
  console.log(`   ${rows.length} satır, ${tumYarislar.length} yarış, anormal-zemin yarış: ${anormalYarisSayisi} (%${((anormalYarisSayisi/tumYarislar.length)*100).toFixed(1)})\n`);

  console.log("5/6 — 4 aday için skorlar hesaplanıyor, DEV'de taranıyor...\n");
  const YONTEMLER: Yontem[] = ["ALL_ABNORMAL", "SAME_SURFACE", "EXACT_FAMILY", "HIERARCHICAL_BLEND"];

  function raceSonucYontem(y: RaceRec, yontem: Yontem) {
    const idx = y.runners.findIndex((r) => r.isWinner);
    const pChamp = softmax(y.runners.map((r) => r.toplamSkorTam), y.liderEsigi); // GERÇEK üretim, dokunulmadı
    const skorlar = y.runners.map((r) => {
      const params = zeminParams(r.segment);
      if (!params) return r.toplamSkorTam; // Handikap/Hibrit: zemin A-katmanında yok, değişmez
      const xHam = xHesapla(r.atAdi, y.date, r.pist, r.rejim, yontem);
      const yeniKatki = params.weight * standardizeTek(xHam, params.mean, params.std);
      return r.toplamSkorTam - r.eskiZeminKatki + yeniKatki;
    });
    const pChal = softmax(skorlar, y.liderEsigi);
    return { pChamp, pChal, idx };
  }

  function karar(ci: { lo: number; hi: number }): "SUPERIOR" | "NON-INFERIOR" | "INFERIOR" {
    if (ci.hi < 0) return "SUPERIOR";
    if (ci.hi < EPSILON) return "NON-INFERIOR";
    return "INFERIOR";
  }
  function bootstrapCI(farklar: number[], B = B_BOOTSTRAP): { nokta: number; lo: number; hi: number } {
    const nokta = farklar.reduce((a, b) => a + b, 0) / farklar.length;
    const dagilim: number[] = [];
    for (let i = 0; i < B; i++) { let t = 0; for (let j = 0; j < farklar.length; j++) t += farklar[Math.floor(Math.random() * farklar.length)]; dagilim.push(t / farklar.length); }
    dagilim.sort((a, b) => a - b);
    return { nokta, lo: dagilim[Math.floor(dagilim.length * 0.025)], hi: dagilim[Math.floor(dagilim.length * 0.975)] };
  }

  const nTrain = Math.floor(tumYarislar.length * 0.6);
  const nDev = Math.floor(tumYarislar.length * 0.2);
  const dev = tumYarislar.slice(nTrain, nTrain + nDev);
  const test = tumYarislar.slice(nTrain + nDev);
  const devAnormal = dev.filter((y) => y.runners.some((r) => r.rejim !== "NORMAL")).length;
  console.log(`   DEV=${dev.length} (anormal:${devAnormal})  TEST=${test.length} (kilitli)\n`);

  function degerlendir(yarislar: RaceRec[], yontem: Yontem) {
    const farklar = yarislar.map((y) => {
      const { pChamp, pChal, idx } = raceSonucYontem(y, yontem);
      return -Math.log(Math.max(pChal[idx], 1e-9)) - -Math.log(Math.max(pChamp[idx], 1e-9));
    });
    return bootstrapCI(farklar);
  }

  const devSonuclar: { yontem: Yontem; ci: ReturnType<typeof bootstrapCI> }[] = [];
  for (const yontem of YONTEMLER) {
    const ci = degerlendir(dev, yontem);
    devSonuclar.push({ yontem, ci });
    console.log(`DEV [${yontem}] ΔLL = ${ci.nokta.toFixed(5)}  95%GA=[${ci.lo.toFixed(5)},${ci.hi.toFixed(5)}]  → ${karar(ci)}`);
  }

  const enIyi = [...devSonuclar].sort((a, b) => a.ci.nokta - b.ci.nokta)[0];
  console.log(`\n6/6 — En iyi aday: ${enIyi.yontem} (DEV ΔLL=${enIyi.ci.nokta.toFixed(5)}) — TEST'te (kilitli) TEK BAŞINA doğrulanıyor...\n`);
  if (karar(enIyi.ci) === "INFERIOR") {
    console.log("→ En iyi aday bile DEV'de INFERIOR. TEST açılmıyor. Hiçbir aday legacy'den iyi değil (bu örneklemde).");
    return;
  }
  const ciTest = degerlendir(test, enIyi.yontem);
  console.log(`TEST [${enIyi.yontem}] ΔLL = ${ciTest.nokta.toFixed(5)}  95%GA=[${ciTest.lo.toFixed(5)},${ciTest.hi.toFixed(5)}]  → ${karar(ciTest)}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
