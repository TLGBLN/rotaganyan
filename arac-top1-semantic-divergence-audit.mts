// TOP1 SEMANTIC DIVERGENCE AUDIT (2026-10-02, kullanıcı tasarımı) — TAMAMEN SALT-OKUNUR.
//
// Bulgu: "1. sıra" kavramının İKİ FARKLI tanımı aynı isim altında kullanılıyor:
//   rawTop1        = ham puana (Pick.score) göre en yüksek at — PUBLIC analiz ekranlarının
//                    kullandığı kaynak (bkz. pick-display-order.ts: siraliPickler)
//   technicalTop1  = Pick.rank === 1 — terfi/postprocess (agfTrendTerfisiUygula,
//                    safModelDegerTerfisiUygula, derinLongshotDuzelt, vb.) SONRASI sıra.
//                    result-sync.ts/race.actions.ts'teki hitTop1 BUNU kullanıyor.
//
// Bu script HİÇBİR ŞEYİ DEĞİŞTİRMEZ — yalnız iki tanım arasındaki sapmayı ölçer:
//   N(rawTop1≠technicalTop1), HitRate_raw, HitRate_technical, ΔHitRate
//   A/B/C/D/E vaka sınıflandırması, promotion-reason HEURİSTİĞİ (kesin değil — bkz. not),
//   engine version (motorEtiketi) + segment (classType) + tarih kırılımı,
//   legacy Result.hitTop1 ↔ yeniden hesaplanan technicalHitTop1 PARİTE kontrolü (bu
//   farklıysa semantik sözleşme sorunu DEĞİL, AYRICA gerçek bir veri/staleness bug'ı var demektir).
//
// Kullanım: node --env-file=.env node_modules/tsx/dist/cli.mjs arac-top1-semantic-divergence-audit.mts
import { db } from "./src/lib/db";
import { hibritMaidenSatisMi } from "./src/lib/methodology/v5-engine";
import { kategoriTespit } from "./src/lib/methodology/v2-engine";

function segmentBelirle(classType: string): string {
  if (hibritMaidenSatisMi(classType)) return "Hibrit";
  const kat = kategoriTespit(classType);
  if (kat === "1a" || kat === "1b") return "Düşük Şart";
  if (kat === "2") return "Handikap";
  return "Diğer";
}

type Vaka = "A" | "B" | "C" | "D" | "E";
type Kayit = {
  raceId: string; date: Date; segment: string; motorEtiketi: string;
  rawNo: number | null; technicalNo: number | null; divergent: boolean;
  rawHit: boolean; technicalHit: boolean; legacyHitTop1: boolean | null; vaka: Vaka | null;
  promotionHeuristic: string | null;
};

async function main() {
  console.log("1/3 — Sonuçlanmış, yayınlanmış tahminler yükleniyor (TÜM tarihçe, TR+YD dahil — filtre yok)...");
  const predictions = await db.prediction.findMany({
    where: { published: true, race: { result: { isNot: null } } },
    select: {
      raceId: true,
      picks: { select: { rank: true, score: true, scoreExact: true, details: true, featureSnapshot: true, runner: { select: { no: true } } } },
      race: {
        select: {
          classType: true,
          raceDay: { select: { date: true, hippodrome: { select: { name: true, isForeign: true } } } },
          result: { select: { winnerNos: true, hitTop1: true } },
        },
      },
    },
  });
  console.log(`   ${predictions.length} yayınlanmış+sonuçlanmış tahmin bulundu.\n`);

  console.log("2/3 — rawTop1 vs technicalTop1 hesaplanıyor...");
  const kayitlar: Kayit[] = [];
  let eksikVeri = 0;

  for (const p of predictions) {
    const picks = p.picks.filter((pk) => pk.runner != null && pk.score != null);
    if (picks.length === 0) { eksikVeri++; continue; }
    const winnerNos = p.race.result?.winnerNos ?? [];
    if (winnerNos.length === 0) { eksikVeri++; continue; }

    // rawTop1: public ekranların KULLANDIĞI AYNI kriter — ham score'a göre en yüksek
    // (pick-display-order.ts:siraliPickler ile BİREBİR aynı sort mantığı).
    const rawSirali = [...picks].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const rawTop1 = rawSirali[0];
    const technicalTop1 = picks.find((pk) => pk.rank === 1) ?? null;

    const rawNo = rawTop1?.runner?.no ?? null;
    const technicalNo = technicalTop1?.runner?.no ?? null;
    const divergent = rawNo != null && technicalNo != null && rawNo !== technicalNo;
    const rawHit = rawNo != null && winnerNos.includes(rawNo);
    const technicalHit = technicalNo != null && winnerNos.includes(technicalNo);

    let vaka: Vaka | null = null;
    if (!divergent) vaka = rawHit ? "A" : "B";
    else if (rawHit && !technicalHit) vaka = "C";
    else if (!rawHit && technicalHit) vaka = "D";
    else if (!rawHit && !technicalHit) vaka = "E";

    // Promotion heuristiği — KESİN DEĞİL: technicalTop1'in gerekçe satırlarında (details.satirlar)
    // "AGFTREND" kodu varsa AGF Trend Terfisi İHTİMAL DAHİLİNDE görülür (bu kod, agfTrendYonu
    // dolu olduğunda HER ZAMAN eklenir — gerçekten terfi PENCERESİNİ kazandığının KANITI değil,
    // yalnız trend bilgisinin var olduğunun kanıtı). Daha kesin bir izleme için terfi
    // bayraklarının (agfTerfi/degerTerfisi) Pick'e AYRICA persist edilmesi gerekirdi — ŞU AN
    // edilmiyor, bu yüzden bu alan yalnız bir İPUCU, kesin mekanizma kanıtı değil.
    let promotionHeuristic: string | null = null;
    if (divergent && technicalTop1?.details) {
      const satirlar = (technicalTop1.details as any)?.satirlar ?? (Array.isArray(technicalTop1.details) ? technicalTop1.details : []);
      const kodlar: string[] = Array.isArray(satirlar) ? satirlar.flatMap((s: any) => s?.kod ?? []) : [];
      if (kodlar.includes("AGFTREND")) promotionHeuristic = "AGF Trend Terfisi (ipucu, kesin değil)";
      else promotionHeuristic = "bilinmiyor/tespit edilemedi";
    }

    const motorEtiketi = (picks.find((pk) => (pk.featureSnapshot as any)?.motorEtiketi)?.featureSnapshot as any)?.motorEtiketi ?? "bilinmiyor (featureSnapshot yok, eski kayıt)";
    const motorKisa = typeof motorEtiketi === "string" ? (motorEtiketi.match(/^(V\d+\.\d+)/)?.[1] ?? motorEtiketi.slice(0, 30)) : "bilinmiyor";

    kayitlar.push({
      raceId: p.raceId, date: p.race.raceDay.date, segment: segmentBelirle(p.race.classType), motorEtiketi: motorKisa,
      rawNo, technicalNo, divergent, rawHit, technicalHit, legacyHitTop1: p.race.result?.hitTop1 ?? null, vaka, promotionHeuristic,
    });
  }
  console.log(`   ${kayitlar.length} yarış analiz edildi (${eksikVeri} eksik veri yüzünden atlandı).\n`);

  console.log("3/3 — Sonuçlar\n");
  const n = kayitlar.length;
  const divergentler = kayitlar.filter((k) => k.divergent);
  const rawHitSayisi = kayitlar.filter((k) => k.rawHit).length;
  const technicalHitSayisi = kayitlar.filter((k) => k.technicalHit).length;

  console.log(`Toplam sonuçlanmış+yayınlanmış yarış: ${n}`);
  console.log(`Divergence (rawTop1 ≠ technicalTop1): ${divergentler.length} (%${((divergentler.length / n) * 100).toFixed(1)})`);
  console.log(`HitRate_raw (ham puan #1 kazandı)       : %${((rawHitSayisi / n) * 100).toFixed(1)} (${rawHitSayisi}/${n})`);
  console.log(`HitRate_technical (Pick.rank=1 kazandı) : %${((technicalHitSayisi / n) * 100).toFixed(1)} (${technicalHitSayisi}/${n})`);
  console.log(`ΔHitRate (technical - raw)              : ${(((technicalHitSayisi - rawHitSayisi) / n) * 100).toFixed(2)} puan\n`);

  const vakaSayilari: Record<Vaka, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (const k of kayitlar) if (k.vaka) vakaSayilari[k.vaka]++;
  console.log("Vaka dağılımı:");
  console.log(`  A (ikisi de aynı, ikisi de tuttu)      : ${vakaSayilari.A}`);
  console.log(`  B (ikisi de aynı, ikisi de tutmadı)    : ${vakaSayilari.B}`);
  console.log(`  C (farklı, raw tuttu / technical tutmadı): ${vakaSayilari.C}`);
  console.log(`  D (farklı, technical tuttu / raw tutmadı): ${vakaSayilari.D}`);
  console.log(`  E (farklı, ikisi de tutmadı)           : ${vakaSayilari.E}\n`);

  console.log("--- Promotion heuristiği dağılımı (yalnız divergent vakalar, İPUCU — kesin mekanizma kanıtı DEĞİL) ---");
  const heuristikSayac = new Map<string, number>();
  for (const k of divergentler) { const h = k.promotionHeuristic ?? "?"; heuristikSayac.set(h, (heuristikSayac.get(h) ?? 0) + 1); }
  for (const [h, sayi] of heuristikSayac) console.log(`  ${h}: ${sayi}`);

  console.log("\n--- Legacy Result.hitTop1 ↔ yeniden hesaplanan technicalHit PARİTE kontrolü ---");
  const parityUyumsuz = kayitlar.filter((k) => k.legacyHitTop1 != null && k.legacyHitTop1 !== k.technicalHit);
  console.log(`Uyumsuz kayıt sayısı: ${parityUyumsuz.length} / ${n}`);
  if (parityUyumsuz.length > 0) {
    console.log("  → BU SEMANTİK SÖZLEŞME SORUNU DEĞİL — AYRICA GERÇEK BİR VERİ/STALENESS BUG'I VAR (ilk 10 örnek):");
    for (const k of parityUyumsuz.slice(0, 10)) console.log(`    raceId=${k.raceId} tarih=${k.date.toISOString().slice(0, 10)} legacyHitTop1=${k.legacyHitTop1} technicalHit(yeniden hesap)=${k.technicalHit}`);
  } else {
    console.log("  → %100 eşleşiyor: veri bozuk DEĞİL, yalnız semantik kontrat (hangi 'sıra' kullanılıyor) netleştirilmemiş.");
  }

  console.log("\n--- Engine version (motorEtiketi) kırılımı ---");
  const motorGruplari = new Map<string, Kayit[]>();
  for (const k of kayitlar) { const g = motorGruplari.get(k.motorEtiketi) ?? []; g.push(k); motorGruplari.set(k.motorEtiketi, g); }
  console.log("Motor".padEnd(35) + "n".padStart(6) + "Divergence%".padStart(13) + "HitRaw%".padStart(10) + "HitTech%".padStart(10) + "ΔHitRate".padStart(10));
  for (const [motor, ks] of [...motorGruplari.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const nn = ks.length;
    const div = ks.filter((k) => k.divergent).length;
    const hr = ks.filter((k) => k.rawHit).length / nn;
    const ht = ks.filter((k) => k.technicalHit).length / nn;
    console.log(motor.padEnd(35) + String(nn).padStart(6) + `${((div / nn) * 100).toFixed(1)}%`.padStart(13) + `${(hr * 100).toFixed(1)}%`.padStart(10) + `${(ht * 100).toFixed(1)}%`.padStart(10) + `${((ht - hr) * 100).toFixed(2)}pp`.padStart(10));
  }

  console.log("\n--- Segment kırılımı ---");
  for (const seg of ["Düşük Şart", "Diğer", "Handikap", "Hibrit"]) {
    const ks = kayitlar.filter((k) => k.segment === seg);
    if (ks.length === 0) { console.log(`${seg}: n=0`); continue; }
    const nn = ks.length;
    const div = ks.filter((k) => k.divergent).length;
    const hr = ks.filter((k) => k.rawHit).length / nn;
    const ht = ks.filter((k) => k.technicalHit).length / nn;
    console.log(`${seg.padEnd(14)} n=${nn}  divergence=%${((div / nn) * 100).toFixed(1)}  HitRaw=%${(hr * 100).toFixed(1)}  HitTech=%${(ht * 100).toFixed(1)}  ΔHitRate=${((ht - hr) * 100).toFixed(2)}pp`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
