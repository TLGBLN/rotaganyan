// TJK resmî Aygır/Kısrak/Kısrak Babası istatistiklerini TjkPedigriStat tablosuna aktarır (Pedigri Merkezi kaynağı).
// Kullanım: node --env-file=.env node_modules/tsx/dist/cli.mjs arac-tjk-pedigri-aktar.mts [--tur SIRE,DAM,DAMSIRE] [--yil 2026,-1]
// -1 = "Tüm Yıllar" (kariyer toplamı). Her (tür×yıl) bitince hemen yazılır; eksik (TJK "Toplam"ından az) varsa mevcut kayıtlar SİLİNMEZ.
// TJK yavaş (≈1 istek/sn): yarış saatinde ÇALIŞTIRMA gerekmez (TJK'ya hafif yük) ama uzun sürer → arka planda çalıştır.
import { db } from "./src/lib/db";
import { fetchTjkPedigriStats, type PedigriKind } from "./src/server/services/ingest/tjk-pedigri-stats.adapter";

const arg = (ad: string, varsayilan: string) => { const i = process.argv.indexOf("--" + ad); return i >= 0 ? process.argv[i + 1] : varsayilan; };

async function main() {
  const turler = arg("tur", "SIRE,DAMSIRE,DAM").split(",") as PedigriKind[];
  const yillar = arg("yil", "2026,-1").split(",").map(Number);
  for (const yil of yillar) for (const kind of turler) {
    const t0 = Date.now();
    const s = await fetchTjkPedigriStats(kind, yil);
    if (!s.rows.length) { console.log(`[${kind} ${yil}] HİÇ SATIR GELMEDİ (TJK toplam ${s.toplamTjk}) — yazılmadı`); continue; }
    const veri = s.rows.map((r) => ({ ...r }));
    if (s.eksik === 0) {
      // İşlem bloğu (transaction) yok: havuz/pgbouncer "işlem başlatılamadı" (P2028) verdi. Veri TAM çekildikten SONRA silinip parça parça yazılır; yarıda kalırsa betik yeniden çalıştırılır.
      await db.tjkPedigriStat.deleteMany({ where: { kind, year: yil } });
      for (let i = 0; i < veri.length; i += 500) await db.tjkPedigriStat.createMany({ data: veri.slice(i, i + 500), skipDuplicates: true });
      console.log(`[${kind} ${yil}] ✔ ${veri.length}/${s.toplamTjk} yazıldı (değiştirildi) | ${((Date.now() - t0) / 1000).toFixed(0)} sn`);
    } else {
      const r = await db.tjkPedigriStat.createMany({ data: veri, skipDuplicates: true });
      console.log(`[${kind} ${yil}] ⚠ EKSİK ${s.eksik}: ${veri.length}/${s.toplamTjk} çekildi; yalnız ${r.count} YENİ satır eklendi, mevcutlar korundu | ${((Date.now() - t0) / 1000).toFixed(0)} sn`);
    }
  }
  const say = await db.tjkPedigriStat.groupBy({ by: ["kind", "year"], _count: { _all: true }, orderBy: [{ year: "desc" }, { kind: "asc" }] });
  console.log("TABLO:", say.map((x) => `${x.kind}/${x.year}=${x._count._all}`).join(" "));
  await db.$disconnect(); process.exit(0);
}
main().catch((e) => { console.error("HATA:", e); process.exit(1); });
