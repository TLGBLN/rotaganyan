// KALICI ARAÇ (2026-09-17) — ZeminToleransi H2 (hiyerarşik context) ve H3 (hiyerarşik
// shrinkage) için sızıntısız backfill. H1 (mevcut/canlı formül) ZATEN her satırda var
// (Row.zeminToleransi, arac-model-veri-olustur.mts'in hesaplaZeminToleransiMap'i) —
// yeniden hesaplamaya GEREK YOK, doğrudan reuse ediliyor.
//
// KRİTİK — kullanıcı talimatı: kosununRejimi (pist-dayanikliligi.ts, PRODUCTION) burada
// KULLANILMIYOR (Sentetik'i koşulsuz NORMAL sayan hardcode'u miras almamak için). Bunun
// yerine ayrı, saf bir `rawPistDurumuCikar` — ham TJK pistDurumu string'ini AYNEN
// (Sentetik dahil) çıkarır, hiçbir "varsayılan NORMAL" kısayolu yok.
//
// H1 (mevcut): atın TÜM pist türlerindeki normal-dışı geçmişini TEK havuzda ortalar.
// H2 (hiyerarşik context): 1) bu pist+TAM durum → yetersizse 2) bu pist+durum AİLESİ →
//   yetersizse 3) bu pistteki TÜM normal-dışı → yetersizse 4) missing (hasEvidence=false).
// H3 (hiyerarşik shrinkage): üç kademeyi n/(n+k) güvenilirlik ağırlığıyla harmanlar —
//   Z = r1*Zexact + (1-r1)*(r2*Zfamily + (1-r2)*Zsurface).
//
// Kilo-düzeltilmiş beklenen-pace tabanı (adım 1-2), zemin-toleransi.actions.ts'teki
// hesaplaZeminToleransiMap'in AYNI mantığı — BİREBİR kopyalandı (yalnız adım 3 farklı).
// Çalıştırma: node --env-file=.env node_modules/tsx/dist/cli.mjs arac-yeni-sinyal-backfill-zemin-hiyerarsi.mts
import { readFileSync, writeFileSync } from "fs";
import { db } from "./src/lib/db";
import { surfaceToPist, breedToIrk } from "./src/lib/sire-stat-match";

const IN_PATH =
  "C:\\Users\\tlgbi\\AppData\\Local\\Temp\\claude\\c--Users-tlgbi-OneDrive-Belgeler-Rota\\76598f4f-31f1-4414-a3f6-fbab0aab98d4\\scratchpad\\model-veri-yeni-adaylar-stil.json";
// 2026-09-17 kullanıcı talebi — duyarlılık analizi: MIN_TIER_ORNEK=env ile değiştirilebilir
// (varsayılan 3, "tek yarıştan kural çıkarılmaz" ilkesiyle tutarlı, bkz. pace-analizi.ts
// MIN_ORNEK) — sonucun eşiğe ne kadar kırılgan/kararlı olduğunu görmek için. Farklı eşikler
// AYRI dosyaya yazılır (üzerine yazma riski yok, kıyaslama için hepsi saklanır).
const MIN_TIER_ORNEK = Number(process.env.MIN_TIER_ORNEK ?? 3);
const SHRINK_K = 5;
const OUT_PATH =
  `C:\\Users\\tlgbi\\AppData\\Local\\Temp\\claude\\c--Users-tlgbi-OneDrive-Belgeler-Rota\\76598f4f-31f1-4414-a3f6-fbab0aab98d4\\scratchpad\\model-veri-yeni-adaylar-zeminh${process.env.MIN_TIER_ORNEK ? `-n${process.env.MIN_TIER_ORNEK}` : ""}.json`;

// ─── Ham TJK pistDurumu çıkarımı — kosununRejimi'nden BAĞIMSIZ, Sentetik hardcode'u YOK ──
const BILINEN_DURUMLAR = ["Çok Yumuşak", "Biraz Yumuşak", "Yumuşak", "Çok Ağır", "Biraz Ağır", "Ağır", "Nemli", "Sulu", "Islak", "Normal"];
function rawPistDurumuCikar(detail: string | undefined | null): string | null {
  const d = (detail ?? "").trim();
  for (const bilinen of BILINEN_DURUMLAR) {
    if (d.toLocaleLowerCase("tr-TR").startsWith(bilinen.toLocaleLowerCase("tr-TR"))) return bilinen;
  }
  return null; // TJK'nın hiç yayınlamadığı/bilinmeyen bir metin — icat etmiyoruz
}
// Aile tanımı — kullanıcının BİREBİR spesifikasyonu.
const AILE: Record<string, string[]> = {
  Nemli: ["Nemli", "Sulu", "Islak"], Sulu: ["Nemli", "Sulu", "Islak"], Islak: ["Nemli", "Sulu", "Islak"],
  "Biraz Yumuşak": ["Biraz Yumuşak", "Yumuşak", "Çok Yumuşak", "Biraz Ağır", "Ağır", "Çok Ağır"],
  Yumuşak: ["Biraz Yumuşak", "Yumuşak", "Çok Yumuşak", "Biraz Ağır", "Ağır", "Çok Ağır"],
  "Çok Yumuşak": ["Biraz Yumuşak", "Yumuşak", "Çok Yumuşak", "Biraz Ağır", "Ağır", "Çok Ağır"],
  "Biraz Ağır": ["Biraz Yumuşak", "Yumuşak", "Çok Yumuşak", "Biraz Ağır", "Ağır", "Çok Ağır"],
  Ağır: ["Biraz Yumuşak", "Yumuşak", "Çok Yumuşak", "Biraz Ağır", "Ağır", "Çok Ağır"],
  "Çok Ağır": ["Biraz Yumuşak", "Yumuşak", "Çok Yumuşak", "Biraz Ağır", "Ağır", "Çok Ağır"],
};

function dereceyeSaniye(t: string | null): number | null {
  if (!t) return null;
  const parts = t.trim().split(".");
  if (parts.length === 3) return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10) + parseInt(parts[2], 10) / 100;
  if (parts.length === 2) return parseInt(parts[0], 10) + parseInt(parts[1], 10) / 100;
  return null;
}
function mesafeyeMetre(m: string): number { return parseInt(m.replace(/\./g, ""), 10); }
function kiloKategorisi(cinsAdi: string): "handikap" | "diger" { return /handikap/i.test(cinsAdi) ? "handikap" : "diger"; }
function parseKilo(kilo: string | null): number | null {
  if (!kilo) return null;
  const n = parseFloat(kilo.replace(",", "."));
  return isNaN(n) ? null : n;
}

type ArsivSatiri = {
  atAdi: string; irk: string; pist: string; mesafe: string; pistDurumu: string;
  derece: string | null; kilo: string | null; cinsAdi: string; tarih: Date | null;
};

async function main() {
  const rows: { raceId: string; runnerId: string; no: number; zeminToleransi: number; [k: string]: unknown }[] = JSON.parse(readFileSync(IN_PATH, "utf-8"));
  const raceIds = [...new Set(rows.map((r) => r.raceId))];

  const races = await db.race.findMany({
    where: { id: { in: raceIds } },
    select: { id: true, breed: true, surface: true, raceDay: { select: { date: true, surfaceConditions: true } } },
  });
  const raceInfoById = new Map(
    races.map((r) => {
      const conds = r.raceDay.surfaceConditions as { label: string; detail: string }[] | null;
      const etiket = r.surface === "CIM" ? "Çim" : r.surface === "KUM" ? "Kum" : "Sentetik";
      const cond = conds?.find((c) => c.label === etiket);
      const pistDurumu = cond ? rawPistDurumuCikar(cond.detail) : "Normal"; // koşul hiç yayınlanmamışsa NORMAL varsayımı (güvenli varsayılan, icat değil)
      return [r.id, { irk: breedToIrk(r.breed), pist: surfaceToPist(r.surface), date: r.raceDay.date, pistDurumu: pistDurumu ?? "Normal" }];
    })
  );

  const runnerIds = [...new Set(rows.map((r) => r.runnerId))];
  const nameByRunnerId = new Map<string, string>();
  const CHUNK = 3000;
  for (let i = 0; i < runnerIds.length; i += CHUNK) {
    const dilim = runnerIds.slice(i, i + CHUNK);
    const runners = await db.runner.findMany({ where: { id: { in: dilim } }, select: { id: true, name: true } });
    for (const r of runners) nameByRunnerId.set(r.id, r.name);
  }

  console.log("TjkDereceKaydi tam arşiv yükleniyor...");
  const arsiv: ArsivSatiri[] = await db.tjkDereceKaydi.findMany({
    where: { derece: { not: null } },
    select: { atAdi: true, irk: true, pist: true, mesafe: true, pistDurumu: true, derece: true, kilo: true, cinsAdi: true, tarih: true },
  });
  console.log(`Arşiv: ${arsiv.length} satır.`);

  // Atın kendi normal-dışı geçmişini isim bazlı önceden grupla (performans için).
  const nonNormalByName = new Map<string, ArsivSatiri[]>();
  for (const s of arsiv) {
    if (s.pistDurumu === "Normal" || !s.pistDurumu) continue;
    const arr = nonNormalByName.get(s.atAdi) ?? [];
    arr.push(s);
    nonNormalByName.set(s.atAdi, arr);
  }

  /** Kilo-düzeltilmiş beklenen-pace tabanı — zemin-toleransi.actions.ts'in AYNI mantığı,
   *  yalnız cutoff parametreli, her çağrıda TAZE hesaplanır (küçük arşiv, ucuz). */
  function tabanHesapla(cutoff: Date) {
    type EgimToplama = { sxy: number; sxx: number; sayi: number };
    const egimToplam = new Map<"handikap" | "diger", EgimToplama>();
    const bucketHam = new Map<string, { pace: number; kilo: number; kategori: "handikap" | "diger" }[]>();
    for (const s of arsiv) {
      if (s.pistDurumu !== "Normal") continue;
      if (s.tarih && s.tarih >= cutoff) continue;
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
    const kiloEgimi = new Map<"handikap" | "diger", number>();
    for (const [kategori, e] of egimToplam.entries()) if (e.sayi >= 30 && e.sxx > 0) kiloEgimi.set(kategori, e.sxy / e.sxx);

    const bucketToplam = new Map<string, { paceToplam: number; kiloToplam: number; sayi: number }>();
    for (const s of arsiv) {
      if (s.pistDurumu !== "Normal") continue;
      if (s.tarih && s.tarih >= cutoff) continue;
      const sn = dereceyeSaniye(s.derece), metre = mesafeyeMetre(s.mesafe), kilo = parseKilo(s.kilo);
      if (!sn || !metre || sn <= 0) continue;
      const bucket = `${s.irk}|${s.pist}|${metre}|${kiloKategorisi(s.cinsAdi)}`;
      const e = bucketToplam.get(bucket) ?? { paceToplam: 0, kiloToplam: 0, sayi: 0 };
      e.paceToplam += metre / sn; e.kiloToplam += kilo ?? 0; e.sayi++;
      bucketToplam.set(bucket, e);
    }
    const bucketOrt = new Map<string, { pace: number; kilo: number }>();
    for (const [k, v] of bucketToplam.entries()) if (v.sayi >= 5) bucketOrt.set(k, { pace: v.paceToplam / v.sayi, kilo: v.kiloToplam / v.sayi });
    return { kiloEgimi, bucketOrt };
  }

  /** Bir atın TEK bir geçmiş normal-dışı kaydının, kendi bucket'ına göre göreli (%) pace'i. */
  function goreliPace(s: ArsivSatiri, taban: ReturnType<typeof tabanHesapla>): number | null {
    const sn = dereceyeSaniye(s.derece), metre = mesafeyeMetre(s.mesafe), kilo = parseKilo(s.kilo);
    if (!sn || !metre || sn <= 0) return null;
    const kategori = kiloKategorisi(s.cinsAdi);
    const bucket = `${s.irk}|${s.pist}|${metre}|${kategori}`;
    const t = taban.bucketOrt.get(bucket);
    if (!t) return null;
    const egim = taban.kiloEgimi.get(kategori);
    const beklenenPace = egim != null && kilo != null ? t.pace + egim * (kilo - t.kilo) : t.pace;
    return ((metre / sn - beklenenPace) / beklenenPace) * 100;
  }

  function ortalama(vals: number[]): number { return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0; }

  console.log("H2/H3 hesaplanıyor...");
  // KRİTİK performans notu: tabanHesapla ~8779 satırlık TÜM arşivi tarıyor — 39877 satır
  // İÇİN DEĞİL, yalnız 1291 TEKİL koşu tarihi için bir kez hesaplanıp önbelleğe alınır
  // (aynı koşudaki tüm atlar AYNI cutoff'u paylaşır).
  const tabanCache = new Map<string, ReturnType<typeof tabanHesapla>>();
  function tabanCached(date: Date): ReturnType<typeof tabanHesapla> {
    const key = date.toISOString();
    let t = tabanCache.get(key);
    if (!t) { t = tabanHesapla(date); tabanCache.set(key, t); }
    return t;
  }
  let islenen = 0;
  const sonuclar = rows.map((row) => {
    islenen++;
    if (islenen % 8000 === 0) console.log(`  ${islenen}/${rows.length}`);
    const info = raceInfoById.get(row.raceId);
    const name = nameByRunnerId.get(row.runnerId);
    if (!info || !name) return { ...row, zeminH2: 0, zeminH2HasEvidence: false, zeminH3: 0, zeminH3HasEvidence: false };

    const gecmis = (nonNormalByName.get(name) ?? []).filter((s) => s.tarih && s.tarih < info.date);
    if (gecmis.length === 0) return { ...row, zeminH2: 0, zeminH2HasEvidence: false, zeminH3: 0, zeminH3HasEvidence: false };

    const taban = tabanCached(info.date);
    const gecmisGoreli = gecmis.map((s) => ({ s, g: goreliPace(s, taban) })).filter((x): x is { s: ArsivSatiri; g: number } => x.g != null);

    const targetDurum = info.pistDurumu;
    const aile = AILE[targetDurum] ?? [targetDurum];
    const exactVals = gecmisGoreli.filter((x) => x.s.pist === info.pist && x.s.pistDurumu === targetDurum).map((x) => x.g);
    const familyVals = gecmisGoreli.filter((x) => x.s.pist === info.pist && aile.includes(x.s.pistDurumu)).map((x) => x.g);
    const surfaceVals = gecmisGoreli.filter((x) => x.s.pist === info.pist).map((x) => x.g);

    // H2 — hiyerarşik context: ilk yeterli kademe kullanılır.
    let zeminH2 = 0, zeminH2HasEvidence = false;
    if (exactVals.length >= MIN_TIER_ORNEK) { zeminH2 = ortalama(exactVals); zeminH2HasEvidence = true; }
    else if (familyVals.length >= MIN_TIER_ORNEK) { zeminH2 = ortalama(familyVals); zeminH2HasEvidence = true; }
    else if (surfaceVals.length >= MIN_TIER_ORNEK) { zeminH2 = ortalama(surfaceVals); zeminH2HasEvidence = true; }

    // H3 — hiyerarşik shrinkage: Z = r1*Zexact + (1-r1)*(r2*Zfamily + (1-r2)*Zsurface)
    const r1 = exactVals.length / (exactVals.length + SHRINK_K);
    const r2 = familyVals.length / (familyVals.length + SHRINK_K);
    const zFamilyBlend = r2 * ortalama(familyVals) + (1 - r2) * ortalama(surfaceVals);
    const zeminH3 = exactVals.length + familyVals.length + surfaceVals.length > 0 ? r1 * ortalama(exactVals) + (1 - r1) * zFamilyBlend : 0;
    const zeminH3HasEvidence = surfaceVals.length > 0;

    return { ...row, zeminH2, zeminH2HasEvidence, zeminH3, zeminH3HasEvidence };
  });
  await db.$disconnect();

  const h2Dolu = sonuclar.filter((r) => r.zeminH2HasEvidence).length;
  const h3Dolu = sonuclar.filter((r) => r.zeminH3HasEvidence).length;
  console.log(`Toplam ${rows.length} satır — H2 kanıtlı: ${h2Dolu} (%${((100 * h2Dolu) / rows.length).toFixed(1)}), H3 kanıtlı: ${h3Dolu} (%${((100 * h3Dolu) / rows.length).toFixed(1)})`);
  writeFileSync(OUT_PATH, JSON.stringify(sonuclar));
  console.log(`Yazıldı: ${OUT_PATH}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
