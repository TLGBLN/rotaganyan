// TJK resmî Aygır/Kısrak/Kısrak Babası istatistiklerini TjkPedigriStat tablosuna aktarır (Pedigri Merkezi kaynağı).
// Kullanım: node --env-file=.env node_modules/tsx/dist/cli.mjs arac-tjk-pedigri-aktar.mts [--tur SIRE,DAM,DAMSIRE] [--yil 2026] [--grup -1,1,3,5,6,8,10] [--pist -1,1,2,4]
// -1 = "Tümü". Grup/Pist yalnız Aygır (SIRE) sayfasında var; diğer türler yalnız (-1,-1) ile çekilir. Her (tür×yıl×grup×pist) bitince hemen yazılır;
// eksik (TJK "Toplam"ından az) varsa mevcut kayıtlar SİLİNMEZ. TJK yavaş ve paralel yükte GEÇİCİ 404 verir → tek süreç çalıştır.
import { db } from "./src/lib/db";
import { AYGIR_GRUPLARI, AYGIR_PISTLERI, cekimUyarilari, fetchTjkPedigriStats, type PedigriKind } from "./src/server/services/ingest/tjk-pedigri-stats.adapter";

const arg = (ad: string, varsayilan: string) => { const i = process.argv.indexOf("--" + ad); return i >= 0 ? process.argv[i + 1] : varsayilan; };

async function main() {
  const turler = arg("tur", "SIRE,DAMSIRE,DAM").split(",") as PedigriKind[];
  const yillar = arg("yil", "2026").split(",").map(Number);
  const gruplar = arg("grup", AYGIR_GRUPLARI.join(",")).split(",").map(Number);
  const pistler = arg("pist", AYGIR_PISTLERI.join(",")).split(",").map(Number);
  for (const yil of yillar) for (const kind of turler) {
    const combos: { grup: number; pist: number }[] = [];
    if (kind === "SIRE") { for (const grup of gruplar) for (const pist of pistler) combos.push({ grup, pist }); } else combos.push({ grup: -1, pist: -1 });
    for (const gp of combos) {
      const t0 = Date.now(); const etiket = `${kind} ${yil} grup=${gp.grup} pist=${gp.pist}`;
      const s = await fetchTjkPedigriStats(kind, yil, gp);
      if (cekimUyarilari.length) { console.log(`[${etiket}] UYARI (${cekimUyarilari.length}): ` + cekimUyarilari.slice(0, 5).join(" | ")); cekimUyarilari.length = 0; }
      if (!s.rows.length) { console.log(`[${etiket}] satır yok (TJK toplam ${s.toplamTjk}) — yazılmadı`); continue; }
      const veri = s.rows.map((r) => ({ ...r }));
      const where = { kind, year: yil, groupId: gp.grup, pistId: gp.pist };
      if (s.eksik === 0) {
        // İşlem bloğu (transaction) yok: havuz/pgbouncer "işlem başlatılamadı" (P2028) verdi. Veri TAM çekildikten SONRA silinip parça parça yazılır; yarıda kalırsa betik yeniden çalıştırılır.
        await db.tjkPedigriStat.deleteMany({ where });
        for (let i = 0; i < veri.length; i += 500) await db.tjkPedigriStat.createMany({ data: veri.slice(i, i + 500), skipDuplicates: true });
        console.log(`[${etiket}] ✔ ${veri.length}/${s.toplamTjk} yazıldı | ${((Date.now() - t0) / 1000).toFixed(0)} sn`);
      } else {
        const r = await db.tjkPedigriStat.createMany({ data: veri, skipDuplicates: true });
        console.log(`[${etiket}] ⚠ EKSİK ${s.eksik}: ${veri.length}/${s.toplamTjk} çekildi; yalnız ${r.count} YENİ satır eklendi, mevcutlar korundu | ${((Date.now() - t0) / 1000).toFixed(0)} sn`);
      }
    }
  }
  const say = await db.tjkPedigriStat.groupBy({ by: ["kind", "year", "groupId", "pistId"], _count: { _all: true }, orderBy: [{ kind: "asc" }, { groupId: "asc" }, { pistId: "asc" }] });
  console.log("TABLO:", say.map((x) => `${x.kind}/${x.year}/g${x.groupId}/p${x.pistId}=${x._count._all}`).join(" "));
  await db.$disconnect(); process.exit(0);
}
main().catch((e) => { console.error("HATA:", e); process.exit(1); });
