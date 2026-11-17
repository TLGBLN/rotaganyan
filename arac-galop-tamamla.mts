/**
 * GALOP TAMAMLAMA — kosu-tipleri popülasyonunda, yarış gününden ÖNCE hiç galop kaydı olmayan
 * at-yarışlar için TJK'dan atın idman geçmişini at adıyla çeker (fetchTjkIdmanByHorseName) ve
 * mevcut sync kuralını aynen uygular: yalnız (atın önceki koşu günü, yarış günü) ARASINDAKİ
 * idmanlar; yarış günü ve sonrası ASLA eklenmez. Önceki koşu bilinmiyorsa son 60 günden en
 * yeni 3. Aynı runner + aynı tarih zaten varsa eklenmez. Hiçbir kayıt silinmez/değişmez.
 * Aşama 1: --getir  → TJK'dan çek, .sinyal-veri/galop-tamamla-onbellek.json'a yaz (DB'ye yazmaz)
 * Aşama 2: --uygula → önbellekten Gallop'a ekle
 */
import fs from "node:fs";
import { db } from "./src/lib/db";
import { GUNCEL_MOTOR_BASLANGIC } from "./src/server/services/admin.service";
import { fetchTjkIdmanByHorseName } from "./src/server/services/ingest/tjk-idman-stats.adapter";

const GETIR = process.argv.includes("--getir");
const UYGULA = process.argv.includes("--uygula");
const DOSYA = ".sinyal-veri/galop-tamamla-onbellek.json";
const G = 86400000;
const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
const gun = (d: Date) => d.toISOString().slice(0, 10);

const rs = await db.race.findMany({
  where: { prediction: { published: true, createdAt: { gte: GUNCEL_MOTOR_BASLANGIC } }, conditions: null, result: { isNot: null } },
  select: { raceDay: { select: { date: true } }, runners: { where: { scratched: false }, select: { id: true, name: true, tjkAtId: true, gallops: { select: { date: true } } } } },
});
const hedef = rs.flatMap((r) => r.runners.filter((x) => !x.gallops.some((q) => q.date < r.raceDay.date)).map((x) => ({ runnerId: x.id, ad: x.name, tjkAtId: x.tjkAtId, rd: r.raceDay.date })));
console.log(`galopsuz at-yarış: ${hedef.length}`);

type Kayit = { runnerId: string; rd: string; satirlar: { tarih: string; track?: string }[] };
if (GETIR) {
  const onb: Record<string, { tarih: string; track?: string; form?: string; surface?: string; jockey?: string; raw: any }[]> = fs.existsSync(DOSYA) ? JSON.parse(fs.readFileSync(DOSYA, "utf8")) : {};
  let i = 0; const bekleyen = [...new Set(hedef.map((h) => h.ad))].filter((a) => !onb[a]);
  const ISCI = 5; // 5 paralel istek (TJK yanıtı ~4-5 sn; tek tek çekmek ~3 saat sürüyordu)
  await Promise.all(Array.from({ length: ISCI }, async () => {
    for (let ad = bekleyen.pop(); ad !== undefined; ad = bekleyen.pop()) {
      try {
        const rows = await fetchTjkIdmanByHorseName(ad.replace(/\s*\([A-Z]{2,3}\)/g, ""));
        onb[ad] = rows.map((x) => ({ tarih: gun(x.trainingDate), raw: x }));
      } catch { /* sonraki turda yeniden denenir */ }
      if (++i % 100 === 0) { fs.mkdirSync(".sinyal-veri", { recursive: true }); fs.writeFileSync(DOSYA, JSON.stringify(onb)); console.log(`çekilen ${i} / kalan ${bekleyen.length}`); }
      await bekle(200);
    }
  }));
  fs.mkdirSync(".sinyal-veri", { recursive: true }); fs.writeFileSync(DOSYA, JSON.stringify(onb));
  console.log(`önbellek yazıldı: ${Object.keys(onb).length} at`);
}

if (UYGULA || (!GETIR && fs.existsSync(DOSYA))) {
  const onb = JSON.parse(fs.readFileSync(DOSYA, "utf8")) as Record<string, { tarih: string; raw: any }[]>;
  // önceki koşu günü: atın geçmiş önbelleğinden (yarış gününden önceki en son satır)
  const idler = [...new Set(hedef.map((h) => h.tjkAtId).filter((x): x is number => x != null))];
  const gec = await db.horseRaceHistoryCache.findMany({ where: { tjkAtId: { in: idler } }, select: { tjkAtId: true, rowsJson: true } });
  const gecMap = new Map(gec.map((g) => [g.tjkAtId, (g.rowsJson as any[]).map((x) => String(x.date).slice(0, 10))]));
  const sayac = { eklenecekSatir: 0, etkilenenAtYarisi: 0, atYarisiOnbellekteYok: 0, kuralDisiKalan: 0 };
  for (const h of hedef) {
    const rows = onb[h.ad];
    if (!rows) { sayac.atYarisiOnbellekteYok++; continue; }
    const rdS = gun(h.rd);
    const onceki = (gecMap.get(h.tjkAtId ?? -1) ?? []).filter((d) => d < rdS).sort().pop();
    let uygun = rows.filter((x) => x.tarih < rdS && (onceki ? x.tarih > onceki : (h.rd.getTime() - new Date(x.tarih).getTime()) / G <= 60));
    uygun = uygun.sort((a, b) => b.tarih.localeCompare(a.tarih));
    if (!onceki) uygun = uygun.slice(0, 3);
    if (uygun.length === 0) { sayac.kuralDisiKalan++; continue; }
    sayac.etkilenenAtYarisi++; sayac.eklenecekSatir += uygun.length;
    if (UYGULA) {
      for (const u of uygun) {
        const d = new Date(`${u.tarih}T00:00:00.000Z`);
        const var_ = await db.gallop.findFirst({ where: { runnerId: h.runnerId, date: d }, select: { id: true } });
        if (var_) continue;
        const r = u.raw;
        // mevcut sync (tjk-idman-stats.adapter) ile BİREBİR aynı alan eşlemesi
        await db.gallop.create({ data: { runnerId: h.runnerId, date: d, track: r.trainingType || undefined, form: r.durum || undefined, jockey: r.jockey || undefined, splits: { ...r.splits, ic_dis: r.position, pist: r.surface } } });
      }
    }
  }
  console.log(JSON.stringify({ mod: UYGULA ? "UYGULA" : "DENEME", ...sayac }));
}
await db.$disconnect(); process.exit(0);
