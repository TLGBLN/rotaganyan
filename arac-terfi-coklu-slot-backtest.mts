// COUNTERFACTUAL BACKTEST — 2026-09-17, V5.46/terfiPenceresiV5'e DOKUNMAZ, salt gözlem.
// Amaç: terfi-rakip-kaybı tanısının (İzmir K6/LODATO + 2 Ankara K2 vakası) önerdiği
// "tek-slot yerine TÜM nitelikli adayları terfi ettir" fikrini AYNI 584 koşuda ölçmek —
// kullanıcı kararı: doğrudan koda sokmadan önce ΔWinnerCoverage / ΔCost karşılaştırması.
//
// ÖNEMLİ METODOLOJİK SINIR (kullanıcı bilerek belirtti): bu script fikrin DOĞDUĞU aynı
// 584 koşuyu kullanıyor (discovery set) — "ne kadar etkilerdi" sorusuna güvenilir cevap
// verir, "gelecekte de işe yarar mı"ya TEK BAŞINA cevap VERMEZ. Kod değişikliği için
// forward/yeni veri gerekir.
//
// TANIM (basitleştirme, açıkça işaretli): "TÜM nitelikliler" burada ilk-6 penceresini
// SIKI 6'da tutup içindekini dışarı itmek yerine, TEK-slot sonucuna (mevcut üretim sırası)
// EK OLARAK hâlâ nitelikli kalan rakip-kaybı adaylarını da "düşük risk" kümesine EKLİYOR
// (arac-terfi-rakip-kaybi-tanisi.mts'teki AYNI nitelik gate'i: fark>=5pp VE nonAgf>0).
// Gerçek üretimde bu splice/yer değiştirme ile de yapılabilir — burada asıl ölçülen
// "ek kaç at eklenir, kazanan kapsamı ne kadar artar" sorusu, kesin dizi mekaniği değil.
//
// KUPON TL MALİYETİ SİMÜLE EDİLMİYOR: Ekonomik/Normal/Geniş kademe seçimi admin'in ELLE
// yaptığı bir karar (KuponForm.tsx), model sırasından OTOMATİK türetilmiyor — bu yüzden
// "eşit bütçe" testi (kullanıcının istediği Test B) bu veriyle DOĞRUDAN simüle edilemez.
// Bunun yerine en yakın hesaplanabilir proxy kullanılıyor: "karar" alanı (Güçlü Aday/
// Düşük Risk/Orta Risk/Yüksek Risk) — admin'in kupon genişletme kararına GİRDİ olan aynı
// alan. Ek at sayısı = bu düşük-risk kümesine TÜM senaryosunda eklenen at sayısı.
//
// Çalıştırma:
//   node --env-file=.env node_modules/tsx/dist/cli.mjs arac-terfi-coklu-slot-backtest.mts --son 600
import { db } from "./src/lib/db";
import { gatherFaz1V5Historical, faz2V5Sirala, AGF_KATKI_INDEKSLERI } from "./src/lib/methodology/v5-engine";
import { GUNCEL_MOTOR_BASLANGIC } from "./src/server/services/admin.service";

const GERCEK_OLMAYAN_HIPODROM_SLUGLARI = ["karma", "perak-malezya"];
const SAF_MODEL_DEGER_ESIGI = 5;
// 2026-09-17 kullanıcı talebi — Sistem C (margin-farkında çoklu-slot): ayrışma-kalibrasyonu
// taramasının bulgusu (<5pp margin ≈ rastgele, 10pp+'ta belirgin edge) burada uygulanıyor —
// yalnız GÜÇLÜ margin'li (fark>=bu eşik) nitelikliler çoklu-slot'a girer, zayıf margin'liler
// (5-10pp) A (mevcut, tek-slot) kadar muhafazakar kalır.
const GUCLU_MARGIN_ESIGI = 10;

function get(argv: string[], bayrak: string) {
  const i = argv.indexOf(bayrak);
  return i >= 0 ? argv[i + 1] : undefined;
}
function nonAgfKatkiToplami(katkilar: number[]): number {
  return katkilar.reduce((toplam, k, i) => (AGF_KATKI_INDEKSLERI.includes(i) ? toplam : toplam + k), 0);
}

async function main() {
  const sonStr = get(process.argv.slice(2), "--son");
  const n = sonStr ? parseInt(sonStr, 10) : 600;

  const races = await db.race.findMany({
    where: {
      result: { isNot: null },
      raceDay: { date: { gte: GUNCEL_MOTOR_BASLANGIC }, hippodrome: { slug: { notIn: GERCEK_OLMAYAN_HIPODROM_SLUGLARI } } },
    },
    select: { id: true },
    orderBy: { raceDay: { date: "desc" } },
    take: n,
  });
  console.log(`${races.length} koşu taranacak.\n`);

  let islenenN = 0;
  // TEK (mevcut üretim, Sistem A) sayaçları
  let tekTop3Hit = 0, tekTop6Hit = 0;
  // TÜM (Sistem B, counterfactual) sayaçları
  let tumTop6Hit = 0;
  let toplamEkstraAt = 0;
  let cokAdaylıKosuSayisi = 0;
  // Sistem C (margin-farkında) sayaçları
  let cTop6Hit = 0;
  let toplamEkstraAt_C = 0;
  // Yalnız 2+ nitelikli aday olan alt-popülasyon (terfi-rakip-kaybı ile AYNI 41 koşu) için ayrı sayaç
  let altPop_n = 0, altPop_tekTop6Hit = 0, altPop_tumTop6Hit = 0, altPop_cTop6Hit = 0, altPop_ekstraAt = 0, altPop_ekstraAt_C = 0;
  let kacirilanKazananSayisi = 0;
  let kacirilanKazananSayisi_C = 0;
  // 2026-09-17 kullanıcı talebi — McNemar + race-level paired bootstrap için per-race kayıt.
  // NOT: B'nin top6 kümesi HER ZAMAN A'nın top6 kümesinin ÜST KÜMESİ (A ∪ ekstra nitelikliler)
  // — yani B, TEKİL bir yarışta ASLA A'dan daha kötü olamaz (n10=0 yapısal olarak garanti).
  // Bu yüzden coverage-only bootstrap/McNemar "B ≥ A" der ama gerçek KARAR testi değildir —
  // asıl soru maliyet tarafında (equal-budget kupon replay, henüz yapılmadı).
  const perRaceKayit: { tekHit: 0 | 1; tumHit: 0 | 1 }[] = [];

  for (const race of races) {
    const faz1 = await gatherFaz1V5Historical(race.id);
    if (!faz1 || faz1.runners.length < 7) continue;
    const sirali = faz2V5Sirala(faz1);
    const result = await db.result.findUnique({ where: { raceId: race.id }, select: { winnerNos: true } });
    if (!result || result.winnerNos.length === 0) continue;
    islenenN++;

    const winnerNos = result.winnerNos;
    const top3Nos = new Set(sirali.slice(0, 3).map((r) => r.no));
    const top6Nos = new Set(sirali.slice(0, 6).map((r) => r.no));

    const tekTop3 = winnerNos.some((no) => top3Nos.has(no));
    const tekTop6 = winnerNos.some((no) => top6Nos.has(no));
    if (tekTop3) tekTop3Hit++;
    if (tekTop6) tekTop6Hit++;

    // Rakip-kaybı adayları: hâlâ ilk-6 dışında ama nitelikli (arac-terfi-rakip-kaybi-tanisi.mts ile AYNI gate)
    const nitelikliler = sirali
      .map((r, i) => ({ r, i }))
      .filter(({ r, i }) => i >= 6 && !r.ekuriIlk6Efektif && (r.marketBlindProb1 * 100 - r.agfPayi) >= SAF_MODEL_DEGER_ESIGI && nonAgfKatkiToplami(r.katkilar) > 0);

    const tumTop6Nos = new Set([...top6Nos, ...nitelikliler.map((x) => x.r.no)]);
    const tumTop6 = winnerNos.some((no) => tumTop6Nos.has(no));
    if (tumTop6) tumTop6Hit++;
    toplamEkstraAt += nitelikliler.length;
    perRaceKayit.push({ tekHit: tekTop6 ? 1 : 0, tumHit: tumTop6 ? 1 : 0 });

    // Sistem C: nitelikliler arasından yalnız GÜÇLÜ margin'li (fark>=10pp) olanlar eklenir.
    const gucluNitelikliler = nitelikliler.filter((x) => (x.r.marketBlindProb1 * 100 - x.r.agfPayi) >= GUCLU_MARGIN_ESIGI);
    const cTop6Nos = new Set([...top6Nos, ...gucluNitelikliler.map((x) => x.r.no)]);
    const cTop6 = winnerNos.some((no) => cTop6Nos.has(no));
    if (cTop6) cTop6Hit++;
    toplamEkstraAt_C += gucluNitelikliler.length;

    if (nitelikliler.length >= 1) {
      // "2+ nitelikli aday" (terfi-rakip-kaybı script'indeki TANIM: TEK-slot terfisi zaten
      // birini yuttuğu için, geriye kalan nitelikliler.length>=1 demek TOPLAMDA 2+ nitelikli
      // vardı demek — terfi eden 1 + rakip-kaybı>=1).
      cokAdaylıKosuSayisi++;
      altPop_n++;
      if (tekTop6) altPop_tekTop6Hit++;
      if (tumTop6) altPop_tumTop6Hit++;
      if (cTop6) altPop_cTop6Hit++;
      altPop_ekstraAt += nitelikliler.length;
      altPop_ekstraAt_C += gucluNitelikliler.length;
      const kacirilan = nitelikliler.find((x) => winnerNos.includes(x.r.no));
      if (kacirilan) kacirilanKazananSayisi++;
      const kacirilan_C = gucluNitelikliler.find((x) => winnerNos.includes(x.r.no));
      if (kacirilan_C) kacirilanKazananSayisi_C++;
    }
  }

  const pct = (a: number, b: number) => (b > 0 ? ((a / b) * 100).toFixed(1) : "—");

  console.log(`İşlenen koşu: ${islenenN}\n`);
  console.log("── TÜM POPÜLASYON — A (TEK/mevcut) vs B (TÜM/çoklu-slot) vs C (margin-farkında) ──");
  console.log(`Kazanan Top3 kapsamı (A, değişmedi — bu script ilk-3 aşamasına dokunmuyor): %${pct(tekTop3Hit, islenenN)} (${tekTop3Hit}/${islenenN})`);
  console.log(`Kazanan Top6 kapsamı — A (TEK)     : %${pct(tekTop6Hit, islenenN)} (${tekTop6Hit}/${islenenN})`);
  console.log(`Kazanan Top6 kapsamı — B (TÜM)     : %${pct(tumTop6Hit, islenenN)} (${tumTop6Hit}/${islenenN})`);
  console.log(`Kazanan Top6 kapsamı — C (margin)  : %${pct(cTop6Hit, islenenN)} (${cTop6Hit}/${islenenN})`);
  console.log(`Δ Winner Top6 (B-A)  : ${(tumTop6Hit - tekTop6Hit)} koşu (+${pct(tumTop6Hit - tekTop6Hit, islenenN)} puan)`);
  console.log(`Δ Winner Top6 (C-A)  : ${(cTop6Hit - tekTop6Hit)} koşu (+${pct(cTop6Hit - tekTop6Hit, islenenN)} puan)`);
  console.log(`Ortalama eklenen at/yarış — B: ${(toplamEkstraAt / islenenN).toFixed(3)}, C: ${(toplamEkstraAt_C / islenenN).toFixed(3)}`);
  const effB = toplamEkstraAt > 0 ? (tumTop6Hit - tekTop6Hit) / toplamEkstraAt : NaN;
  const effC = toplamEkstraAt_C > 0 ? (cTop6Hit - tekTop6Hit) / toplamEkstraAt_C : NaN;
  console.log(`Efficiency (ΔWinnerCoverage / ΔToplamAt) — B: ${effB.toFixed(4)}, C: ${effC.toFixed(4)} ${effC > effB ? "(C daha verimli — daha az at ekleyip benzer/daha iyi kapsama)" : ""}`);

  console.log(`\n── ALT-POPÜLASYON (2+ nitelikli aday olan ${altPop_n} koşu — terfi-rakip-kaybı ile AYNI küme) ──`);
  console.log(`Kazanan Top6 kapsamı — A (TEK)   : %${pct(altPop_tekTop6Hit, altPop_n)} (${altPop_tekTop6Hit}/${altPop_n})`);
  console.log(`Kazanan Top6 kapsamı — B (TÜM)   : %${pct(altPop_tumTop6Hit, altPop_n)} (${altPop_tumTop6Hit}/${altPop_n})`);
  console.log(`Kazanan Top6 kapsamı — C (margin): %${pct(altPop_cTop6Hit, altPop_n)} (${altPop_cTop6Hit}/${altPop_n})`);
  console.log(`Ortalama eklenen at/yarış (bu alt-pop) — B: ${(altPop_ekstraAt / altPop_n).toFixed(2)}, C: ${(altPop_ekstraAt_C / altPop_n).toFixed(2)}`);
  console.log(`Kaçırılan kazanan yakalanan — B: ${kacirilanKazananSayisi}/${altPop_n}, C: ${kacirilanKazananSayisi_C}/${altPop_n}`);

  console.log(`\n── KUPON MALİYETİ PROXY (gerçek TL simüle edilmiyor, bkz. üst not) ──`);
  console.log(`"Düşük Risk" kümesine eklenen ortalama at/yarış — B (tüm popülasyon): ${(toplamEkstraAt / islenenN).toFixed(3)}, C: ${(toplamEkstraAt_C / islenenN).toFixed(3)}`);
  console.log(`Bu, admin'in Normal/Geniş kademeye kaç at daha EKLEMEYİ DÜŞÜNEBİLECEĞİNİN kaba bir üst sınırı — gerçek TL maliyeti admin kararına bağlı, doğrudan hesaplanamaz.`);

  // 2026-09-17 kullanıcı talebi — McNemar + race-level paired bootstrap (formalite/rigor
  // için istendi). ÖNEMLİ: B'nin top6 kümesi A'nın ÜST KÜMESİ olduğu için n10 (A kazandı,
  // B kaybetti) YAPISAL OLARAK 0'dır — bu test "B ≥ A"yı zaten BİLİNEN bir gerçeği
  // doğrular, KARAR VERİCİ değildir. Asıl karar equal-budget kupon replay'inde.
  console.log(`\n── McNEMAR + RACE-LEVEL PAIRED BOOTSTRAP (formalite — B'nin coverage'ı A'nın üst kümesi olduğu için yapısal olarak B≥A, karar verici DEĞİL) ──`);
  const n01 = perRaceKayit.filter((r) => r.tekHit === 0 && r.tumHit === 1).length; // A kaybetti, B kazandı
  const n10 = perRaceKayit.filter((r) => r.tekHit === 1 && r.tumHit === 0).length; // A kazandı, B kaybetti (yapısal olarak 0 beklenir)
  console.log(`  n01 (A ıska, B isabet) = ${n01}, n10 (A isabet, B ıska) = ${n10} ${n10 === 0 ? "(beklendiği gibi — B, A'nın üst kümesi)" : "⚠ BEKLENMEYEN — kod hatası olabilir"}`);
  const mcnemarChi2 = n01 + n10 > 0 ? ((Math.abs(n01 - n10) - 1) ** 2) / (n01 + n10) : 0;
  console.log(`  McNemar χ² (süreklilik düzeltmeli) = ${mcnemarChi2.toFixed(2)} (n01+n10=${n01 + n10} küçükse yaklaşık dağılım güvenilmez, exact binom tercih edilir: n10=0 iken p=(0.5)^${n01}≈${(0.5 ** n01).toExponential(2)})`);

  function mulberry32(a: number) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rngB = mulberry32(5462026);
  const B_BOOT = 1000;
  const deltaBoot: number[] = [];
  for (let b = 0; b < B_BOOT; b++) {
    let tekSum = 0, tumSum = 0;
    for (let i = 0; i < perRaceKayit.length; i++) {
      const r = perRaceKayit[Math.floor(rngB() * perRaceKayit.length)];
      tekSum += r.tekHit; tumSum += r.tumHit;
    }
    deltaBoot.push((tumSum - tekSum) / perRaceKayit.length);
  }
  const sortedD = [...deltaBoot].sort((a, b) => a - b);
  const dLo = sortedD[Math.floor(0.025 * sortedD.length)];
  const dHi = sortedD[Math.floor(0.975 * sortedD.length)];
  console.log(`  Δcoverage (B-A) bootstrap %95 GA: [+${(dLo * 100).toFixed(2)}pp, +${(dHi * 100).toFixed(2)}pp] (yapısal olarak hep ≥0)`);

  console.log(`\n── SONRAKİ ADIM (kullanıcı kararı): EQUAL-BUDGET KUPON REPLAY ──`);
  console.log(`Bu, coverage-only testin GÖREMEDİĞİ asıl soruyu (aynı TL bütçede B, A'dan daha çok isabet ediyor mu) cevaplar.`);
  console.log(`Gerçek HomeKupon leg verisiyle kurulmalı — admin'in ekstra atı hangi kademeye (Normal/Geniş) ekleyeceği varsayımı GEREKİYOR, bu varsayım kullanıcıyla netleşmeden koda dökülmedi.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
