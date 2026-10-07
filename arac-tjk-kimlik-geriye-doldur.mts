// Ocak–Temmuz tjkAtId geriye doldurma (TJK geçmiş program sayfası → Runner.tjkAtId).
// Varsayılan: SALT-OKUNUR. Eşleme dosyası + ilerleme günlüğü üretir.
// --yaz: YALNIZ tjkAtId'si boş ve (hipodrom, koşu no, at no, isim) birebir eşleşen Runner'lar güncellenir.
import { writeFileSync, appendFileSync, existsSync, unlinkSync } from "node:fs";
import { discoverTurkishCities, fetchCityProgram } from "./src/server/services/ingest/tjk-info.adapter";
import { db } from "./src/lib/db";

const YAZ = process.argv.includes("--yaz");
const S = "C:/Users/tlgbi/AppData/Local/Temp/claude/c--Users-tlgbi-OneDrive-Belgeler-Rota/76598f4f-31f1-4414-a3f6-fbab0aab98d4/scratchpad";
const LOG = `${S}/tjk-kimlik-ilerleme.log`;
const CIKTI = `${S}/tjk-kimlik-esleme.json`;
const norm = (x: string) => x.toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();
const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (s: string) => appendFileSync(LOG, `${new Date().toISOString()} ${s}\n`);
if (existsSync(LOG)) unlinkSync(LOG);

const BAS = new Date("2026-01-01T00:00:00.000Z");
const SON = new Date("2026-08-01T00:00:00.000Z");

// Tüm aralığı TEK sorguda yükle (gün başına sorgu yerine)
const tumRunner = await db.runner.findMany({
  where: { race: { raceDay: { date: { gte: BAS, lt: SON } } } },
  select: { id: true, no: true, name: true, tjkAtId: true, race: { select: { raceNo: true, raceDay: { select: { date: true, hippodrome: { select: { name: true } } } } } } },
});
const gunAnahtar = (d: Date) => d.toISOString().slice(0, 10);
const dbHarita = new Map<string, (typeof tumRunner)[number][]>();
for (const r of tumRunner) {
  const k = `${gunAnahtar(r.race.raceDay.date)}`;
  const a = dbHarita.get(k) ?? []; a.push(r); dbHarita.set(k, a);
}
const gunler = [...dbHarita.keys()].sort();
log(`GUN ${gunler.length}, RUNNER ${tumRunner.length}, bos_tjk ${tumRunner.filter((r) => r.tjkAtId == null).length}`);

const sayac = { tjkSatir: 0, dbEsle: 0, isimUyusan: 0, isimUyusmayan: 0, dbDoluAtla: 0 };
const eslemeler: { runnerId: string; tjkAtId: number; iso: string; isim: string }[] = [];
const uyusmayan: any[] = [];
const hatalar: string[] = [];

for (const [gi, iso] of gunler.entries()) {
  const [y, m, d] = iso.split("-");
  const tjkTarih = `${d}/${m}/${y}`;
  const dbRows = dbHarita.get(iso) ?? [];
  const dbAnahtar = new Map<string, (typeof dbRows)[number]>();
  for (const r of dbRows) dbAnahtar.set(`${norm(r.race.raceDay.hippodrome.name)}|${r.race.raceNo}|${r.no}`, r);
  try {
    const sehirler = await discoverTurkishCities(tjkTarih);
    for (const s of sehirler) {
      await bekle(250);
      const gun: any = await fetchCityProgram(s, tjkTarih);
      if (!gun) continue;
      gun.races.forEach((kos: any, i: number) => {
        for (const t of kos.runners ?? []) {
          sayac.tjkSatir++;
          if (t.tjkAtId == null) continue;
          const r = dbAnahtar.get(`${norm(s.sehirAdi)}|${i + 1}|${t.no}`);
          if (!r) continue;
          sayac.dbEsle++;
          if (norm(r.name) !== norm(t.name)) {
            sayac.isimUyusmayan++;
            uyusmayan.push({ iso, sehir: s.sehirAdi, kosu: i + 1, no: t.no, tjk: t.name, db: r.name });
            continue;
          }
          sayac.isimUyusan++;
          if (r.tjkAtId != null) { sayac.dbDoluAtla++; continue; }
          eslemeler.push({ runnerId: r.id, tjkAtId: t.tjkAtId, iso, isim: t.name });
        }
      });
    }
  } catch (e) {
    hatalar.push(`${iso}: ${(e as Error).message}`);
  }
  log(`${gi + 1}/${gunler.length} ${iso} eslesen=${sayac.dbEsle} uyusmayan=${sayac.isimUyusmayan} yazilacak=${eslemeler.length} hata=${hatalar.length}`);
  if ((gi + 1) % 10 === 0) writeFileSync(CIKTI, JSON.stringify({ sayac, eslemeler, uyusmayan, hatalar, tamamlandi: false }));
}

writeFileSync(CIKTI, JSON.stringify({ sayac, eslemeler, uyusmayan, hatalar, tamamlandi: true }, null, 1));
log(`BITTI ${JSON.stringify({ sayac, yazilacak: eslemeler.length, uyusmayan: uyusmayan.length, hata: hatalar.length })}`);

if (YAZ) {
  for (let i = 0; i < eslemeler.length; i += 50) {
    await Promise.all(eslemeler.slice(i, i + 50).map((e) => db.runner.update({ where: { id: e.runnerId }, data: { tjkAtId: e.tjkAtId } })));
  }
  log(`YAZILDI ${eslemeler.length}`);
}
process.exit(0);
