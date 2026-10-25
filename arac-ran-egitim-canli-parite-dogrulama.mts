// ROTAGANYAN ANALİZ MOTORU — EĞİTİM/CANLI HESAPLAMA EŞİTLİĞİ DOĞRULAMASI (Faz 1, madde 1).
//
// Amaç: buildUnifiedFeatureVectorsForRace (hem eğitim veri toplama script'lerinde hem
// bağımsız-kabul script'inde ZATEN kullanılıyor) şimdiye kadar hiçbir CANLI route'a
// bağlanmadı. Bu script, aynı fonksiyonun iki FARKLI çağrı şekliyle (a) "eğitim tarzı"
// (accuraceKosulari() toplu ÖNCEDEN çekilip preloadedAccuraceRuns olarak verilir — toplu
// veri toplama script'lerindeki N+1 önleme deseni) ve (b) "canlı tarzı" (hiçbir ön-yükleme
// yok, fonksiyon KENDİSİ DB'den taze veri çeker) çağrıldığında, GERÇEK bir raceId için
// BİREBİR AYNI özellik vektörünü ürettiğini kanıtlar — yani "eğitim ve canlı aynı kodu
// kullanıyor" iddiası somut, gerçek-DB'li bir karşılaştırmayla DOĞRULANMIŞ olur.
//
// Gerçek DB'ye bağlanır (okuma amaçlı, YAZMA YOK). Çalıştırma:
//   node --env-file=.env node_modules/tsx/dist/cli.mjs arac-ran-egitim-canli-parite-dogrulama.mts
import { buildUnifiedFeatureVectorsForRace } from "./src/lib/rotaganyan-analiz-motoru/feature-calculators/unified-feature-vector";
import { accuraceKosulari } from "@/lib/accurace/loader";
import type { RunnerFeatureVector } from "./src/lib/motor-v1/engine/feature-vector";

// Gerçek, bağımsız-kabul setinden (2026-10-24, arac-ran-egitim-veri-topla-son.mts'in
// GERÇEKTEN ürettiği C:/tmp/ran-egitim-verisi-SON-checkpoint.json) 3 gerçek raceId.
const RACE_IDS = [
  "cmvki7ew100hd08jnzcul6vur", // 2026-10-24, 13 koşucu
  "cmvki6cq300bw08jntfahm7i0", // 2026-10-24, 12 koşucu
  "cmvki5ex0006808jn9bu3dkjm", // 2026-10-24, 8 koşucu
];

function normalize(vectors: RunnerFeatureVector[]) {
  return [...vectors]
    .sort((a, b) => a.no - b.no)
    .map((v) => ({
      ...v,
      signals: [...v.signals].sort((a, b) => a.code.localeCompare(b.code)),
    }));
}

function diffVectors(a: RunnerFeatureVector[], b: RunnerFeatureVector[]): string[] {
  const diffs: string[] = [];
  const na = normalize(a);
  const nb = normalize(b);
  if (na.length !== nb.length) diffs.push(`koşucu sayısı farklı: eğitim-tarzı=${na.length} canlı-tarzı=${nb.length}`);
  const byNoA = new Map(na.map((v) => [v.no, v]));
  const byNoB = new Map(nb.map((v) => [v.no, v]));
  for (const no of new Set([...byNoA.keys(), ...byNoB.keys()])) {
    const va = byNoA.get(no);
    const vb = byNoB.get(no);
    if (!va || !vb) {
      diffs.push(`no=${no}: bir tarafta yok (eğitim-tarzı=${!!va}, canlı-tarzı=${!!vb})`);
      continue;
    }
    const sa = JSON.stringify(va.signals);
    const sb = JSON.stringify(vb.signals);
    if (sa !== sb) {
      diffs.push(`no=${no} (${va.name}): sinyal vektörleri FARKLI`);
      for (let i = 0; i < Math.max(va.signals.length, vb.signals.length); i++) {
        const sigA = va.signals[i];
        const sigB = vb.signals[i];
        if (JSON.stringify(sigA) !== JSON.stringify(sigB)) {
          diffs.push(`    [${i}] eğitim-tarzı=${JSON.stringify(sigA)}`);
          diffs.push(`    [${i}] canlı-tarzı =${JSON.stringify(sigB)}`);
        }
      }
    }
  }
  return diffs;
}

async function main() {
  console.log("=== ROTAGANYAN ANALİZ MOTORU — eğitim/canlı parite doğrulaması (GERÇEK DB) ===\n");
  let hepsiGecti = true;

  for (const raceId of RACE_IDS) {
    console.log(`--- raceId=${raceId} ---`);

    const t0 = Date.now();
    const preloaded = await accuraceKosulari(); // eğitim script'lerinin yaptığı TOPLU ön-yükleme
    const { vectors: egitimTarzi } = await buildUnifiedFeatureVectorsForRace(raceId, preloaded);
    const t1 = Date.now();
    console.log(`  eğitim-tarzı çağrı (preloadedAccuraceRuns VERİLDİ): ${egitimTarzi.length} koşucu, ${t1 - t0}ms`);

    const t2 = Date.now();
    const { vectors: canliTarzi } = await buildUnifiedFeatureVectorsForRace(raceId); // preload YOK — fonksiyon kendisi taze çeker
    const t3 = Date.now();
    console.log(`  canlı-tarzı çağrı   (preloadedAccuraceRuns YOK, DB'den taze):  ${canliTarzi.length} koşucu, ${t3 - t2}ms`);

    const diffs = diffVectors(egitimTarzi, canliTarzi);
    if (diffs.length === 0) {
      console.log(`  SONUÇ: BİREBİR AYNI (${egitimTarzi.length} koşucu × ${egitimTarzi[0]?.signals.length ?? 0} sinyal, hiçbir fark yok)\n`);
    } else {
      hepsiGecti = false;
      console.log(`  SONUÇ: FARK VAR (${diffs.length} satır):`);
      for (const d of diffs) console.log(`    ${d}`);
      console.log("");
    }
  }

  console.log(hepsiGecti ? "=== TÜM YARIŞLAR: eğitim-tarzı === canlı-tarzı (parite doğrulandı) ===" : "=== BAŞARISIZ: en az bir yarışta fark bulundu ===");
  process.exit(hepsiGecti ? 0 : 1);
}

main().catch((e) => {
  console.error("HATA:", e);
  process.exit(1);
});
