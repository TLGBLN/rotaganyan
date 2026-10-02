// TR Accurace Sectional Intelligence V1 — kanıt amaçlı gösterim aracı (2026-10-02).
// Gerçek DB verisinden birkaç at için Sectional Performance Card üretip ekrana basar.
// Hiçbir şey YAZMAZ, V5.46'ya dokunmaz — yalnız sectional-intelligence.ts'in gerçek
// veride çalıştığını kanıtlamak için.
//
// Kullanım: node --env-file=.env node_modules/tsx/dist/cli.mjs arac-sectional-performance-card-ornek.mts [--at "AT ADI"]
import { db } from "./src/lib/db";
import {
  segmentlereAyir,
  sahaSegmentIstatistikleri,
  relativeSplitSD,
  olusturSectionalPerformanceCard,
  type SectionalCheckpoint,
} from "./src/lib/methodology/sectional-intelligence";

const args = process.argv.slice(2);
const atArg = (() => {
  const i = args.indexOf("--at");
  return i >= 0 ? args[i + 1] : undefined;
})();

function cardMetni(card: ReturnType<typeof olusturSectionalPerformanceCard>, horseName: string): string {
  const satirlar: string[] = [];
  satirlar.push(`${horseName} — ${card.baslik}`);
  satirlar.push("");
  if (card.erkenBolumKaybi.deficit100mSn != null) satirlar.push(`100m deficit          ${fmtSn(card.erkenBolumKaybi.deficit100mSn)} sn`);
  if (card.erkenBolumKaybi.deficit200mSn != null) satirlar.push(`200m deficit          ${fmtSn(card.erkenBolumKaybi.deficit200mSn)} sn`);
  if (card.erkenBolumKaybi.selfNormalizedDeficit100mSn != null)
    satirlar.push(`100m deficit (kendi geçmişine göre) ${fmtSn(card.erkenBolumKaybi.selfNormalizedDeficit100mSn)} sn`);
  satirlar.push(`Early position        ${card.erkenSira ?? "?"}/${card.fieldSize}`);
  for (const s of card.relativeSplits) {
    if (s.sd == null) continue;
    const anomali = card.anomaliler.find((a) => a.from === s.from && a.to === s.to);
    const etiket = anomali ? (anomali.tip === "SLOWDOWN" ? "  ← slowdown" : "  ← rebound") : "";
    satirlar.push(`${s.from}–${s.to}m relative     ${fmtSn(s.sd)} SD${etiket}`);
  }
  satirlar.push(`Last 400 bitiş sırası  ${card.son400BitisSirasi ?? "?"}`);
  satirlar.push(`Erken göreli tempo     ${fmtSn(card.tempoProfili.erkenGoreliTempoSD)} SD`);
  satirlar.push(`Orta göreli tempo      ${fmtSn(card.tempoProfili.ortaGoreliTempoSD)} SD`);
  satirlar.push(`Geç göreli tempo       ${fmtSn(card.tempoProfili.gecGoreliTempoSD)} SD`);
  satirlar.push(`Pozisyon kazancı/kaybı ${card.tempoProfili.pozisyonKazanciKaybi ?? "?"}`);
  satirlar.push("");
  satirlar.push("YORUM:");
  for (const y of card.yorumSatirlari) satirlar.push(`  ${y}`);
  return satirlar.join("\n");
}

function fmtSn(v: number | null): string {
  if (v == null) return "?";
  return v >= 0 ? `+${v}` : `${v}`;
}

async function main() {
  // Checkpoint sayısı yeterli (>=8, yani ~800m+ mesafe) ve runnerId eşleşmiş birkaç
  // gerçek split seçiyoruz — kısa/eksik veri kartı anlamsızlaştırmasın diye.
  const splits = await db.accuraceHorseSplit.findMany({
    where: atArg ? { horseName: atArg } : {},
    orderBy: { accuraceRace: { date: "desc" } },
    take: atArg ? 5 : 30,
    include: { accuraceRace: { select: { date: true, citySlug: true, hippodrome: true, length: true, ground: true, id: true } } },
  });

  let gosterilen = 0;
  for (const split of splits) {
    if (gosterilen >= 5) break;
    const checkpoints = split.checkpoints as unknown as SectionalCheckpoint[];
    if (checkpoints.length < 8) continue;

    const sahaSplits = await db.accuraceHorseSplit.findMany({
      where: { accuraceRaceId: split.accuraceRaceId },
      select: { checkpoints: true },
    });
    if (sahaSplits.length < 4) continue; // çok küçük saha, istatistik güvenilmez

    const sahaSegmentleri = sahaSplits.map((s) => segmentlereAyir(s.checkpoints as unknown as SectionalCheckpoint[]));
    const sahaStatleri = sahaSegmentIstatistikleri(sahaSegmentleri);

    // Kendi geçmiş 0-100m profili (leak-free: bu yarıştan ÖNCEKİ Accurace kayıtları).
    const gecmisSplits = await db.accuraceHorseSplit.findMany({
      where: { horseName: split.horseName, accuraceRace: { date: { lt: split.accuraceRace.date } } },
      select: { checkpoints: true },
      take: 10,
    });
    const gecmis100mSureleri = gecmisSplits
      .map((g) => segmentlereAyir(g.checkpoints as unknown as SectionalCheckpoint[]).find((s) => s.from === 0 && s.to === 100)?.durationMs)
      .filter((v): v is number => v != null);
    const kendiGecmis100mOrtalamasiMs =
      gecmis100mSureleri.length >= 3 ? gecmis100mSureleri.reduce((a, b) => a + b, 0) / gecmis100mSureleri.length : null;

    const card = olusturSectionalPerformanceCard({
      hippodrome: split.accuraceRace.hippodrome ?? split.accuraceRace.citySlug,
      surface: split.accuraceRace.ground ?? "?",
      distance: split.accuraceRace.length ?? checkpoints[checkpoints.length - 1].checkpoint,
      fieldSize: sahaSplits.length,
      checkpoints,
      sahaStatleri,
      kendiGecmis100mOrtalamasiMs,
    });

    console.log("=".repeat(70));
    console.log(cardMetni(card, split.horseName));
    console.log(`(saha büyüklüğü=${sahaSplits.length}, geçmiş 100m örneklem n=${gecmis100mSureleri.length})`);
    gosterilen++;
  }
  if (gosterilen === 0) console.log("Uygun kayıt bulunamadı (checkpoints<8 veya saha<4).");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
