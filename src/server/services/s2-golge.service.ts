import { db } from "@/lib/db";
import { kiyasla, S2_AGIRLIK, type KiyasGirdi, type SnapSinyal } from "@/lib/methodology/s2-golge";

// S2 gölge kıyas servisi: sonuçlanmış + yayınlanmış koşuların KAYITLI yarış-öncesi snapshot'ından (Pick.featureSnapshot) canlı(24) ve S2(17)
// yeniden puanlanır, sonuç S2GolgeKiyas tablosuna yazılır. Canlı tahmin/ağırlık/kupon DEĞİŞMEZ; salt ölçüm. İdempotent (raceId unique; var olan atlanır).
type Snap = { tumSinyaller?: { kod: string; hamDeger?: number | null; observed?: boolean; reliability?: number | null }[] } | null;
const gunStr = (d: Date) => d.toISOString().slice(0, 10);

export async function s2GolgeCalistir(opts: { gunSayisi?: number; bugun?: Date } = {}) {
  const bugun = opts.bugun ?? new Date(); const gunSayisi = opts.gunSayisi ?? 3;
  const baslangic = new Date(Date.UTC(bugun.getUTCFullYear(), bugun.getUTCMonth(), bugun.getUTCDate() - gunSayisi));
  const yarislar = await db.race.findMany({
    where: { raceDay: { date: { gte: baslangic }, hippodrome: { name: { not: "Karma" } } }, result: { isNot: null }, prediction: { is: { published: true } } },
    select: { id: true, raceNo: true, classType: true, raceDay: { select: { date: true, hippodrome: { select: { slug: true } } } }, result: { select: { winnerNos: true } },
      runners: { select: { id: true, no: true } }, prediction: { select: { picks: { select: { runnerId: true, scoreExact: true, featureSnapshot: true } } } } },
  });
  const var_ = new Set((await db.s2GolgeKiyas.findMany({ where: { raceId: { in: yarislar.map((r) => r.id) } }, select: { raceId: true } })).map((x) => x.raceId));
  const sayac: Record<string, number> = { GECERLI: 0, GECERSIZ: 0, KAPSAM_DISI: 0, zatenVar: var_.size };
  for (const r of yarislar) {
    if (var_.has(r.id)) continue;
    const noOf = new Map(r.runners.map((x) => [x.id, x.no]));
    const atlar: KiyasGirdi["atlar"] = []; let eksikAt = false;
    for (const p of r.prediction?.picks ?? []) {
      const no = p.runnerId ? noOf.get(p.runnerId) : undefined; if (no == null) { eksikAt = true; continue; }
      const snap = p.featureSnapshot as Snap;
      const sinyaller: SnapSinyal[] = (snap?.tumSinyaller ?? []).map((s) => ({ kod: s.kod, hamDeger: s.hamDeger ?? null, observed: s.observed === true, reliability: typeof s.reliability === "number" ? s.reliability : null }));
      atlar.push({ no, kayitliP: p.scoreExact, sinyaller });
    }
    const sonuc = eksikAt ? ({ durum: "GECERSIZ", neden: "ESKI_SINYAL_KAYDI", ayrinti: "pick'te at eşleşmesi yok" } as const) : kiyasla({ tip: r.classType, kazananlar: r.result?.winnerNos ?? [], atlar });
    sayac[sonuc.durum] = (sayac[sonuc.durum] ?? 0) + 1;
    const g = sonuc.durum === "GECERLI" ? sonuc : null; const kz = g ? g.atlar.find((a) => a.no === g.kazananNo) : null;
    await db.s2GolgeKiyas.create({ data: {
      raceId: r.id, tarih: gunStr(r.raceDay.date), hipodrom: r.raceDay.hippodrome.slug, kosuNo: r.raceNo, sinif: r.classType, durum: sonuc.durum,
      neden: "neden" in sonuc ? sonuc.neden : null, ayrinti: "ayrinti" in sonuc ? (sonuc.ayrinti ?? null) : null, maxFarkPp: "maxFarkPp" in sonuc ? (sonuc.maxFarkPp ?? null) : null,
      kazananNo: g?.kazananNo ?? null, canliSira: g?.canliSira ?? null, s2Sira: g?.s2Sira ?? null, canliP: kz?.canliP ?? null, s2P: kz?.s2P ?? null,
      atlarJson: g ? g.atlar : undefined, agirlikS2: (S2_AGIRLIK as unknown as { generatedAt?: string }).generatedAt ?? "bilinmiyor",
    } });
  }
  return { incelenen: yarislar.length, yeni: yarislar.length - var_.size, ...sayac };
}
