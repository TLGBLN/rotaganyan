// TJK pedigri istatistiklerinin GÜNLÜK YENİLEMESİ (parçalı kuyruk) + günlük görüntü arşivi.
// Neden parçalı: TJK yavaş (tüm 2026 verisi dakikalar–saatler sürer) ve Vercel işlevi ~800 sn ile sınırlı. Her gün için (tür × yıl × grup × pist) birimleri üretilir
// (TjkPedigriSyncUnit); cron (sabah, ~20 dk arayla) her çalışmada zaman bütçesi kadar sıradaki birimi çeker. Tüm birimler bitince GÜNLÜK GÖRÜNTÜ alınır
// (TjkPedigriSnapshot): o günkü yarışlar için yarış ÖNCESİ veri kesiti — geçmiş bir yarış, o günün görüntüsüyle analiz edilebilir (yarış sonucu sızmaz).
// Yalnız cari yıl yenilenir (önceki yıllar kapanmış, değişmez).
import { db } from "@/lib/db";
import { AYGIR_GRUPLARI, AYGIR_PISTLERI, KISRAK_BABASI_GRUPLARI, cekimUyarilari, fetchTjkPedigriStats } from "@/server/services/ingest/tjk-pedigri-stats.adapter";
import { birimAnahtari, snapshotKodla, syncBirimleri, trGunu, type SnapSatir, type SyncBirim } from "@/lib/tjk-pedigri-snapshot";

const MAKS_DENEME = 3;
const BIRIM_MIN_SURE_MS = { DAM: 420_000, DEFAULT: 150_000 }; // birime başlamak için kalması gereken süre (Kısrak ≈ 100 sayfa)
const BAYAT_RUNNING_MS = 20 * 60_000;

export type SyncSonuc = {
  gun: string; yil: number;
  durum: "TAMAMLANDI-ZATEN" | "DEVAM" | "TAMAMLANDI";
  buCalismada: { birim: string; sonuc: string; satir: number | null; sureSn: number }[];
  kalan: number; toplam: number;
  gorunumAlindi: boolean;
};

export async function tjkPedigriSyncCalistir(opts?: { butceMs?: number; simdi?: Date }): Promise<SyncSonuc> {
  const t0 = Date.now(); const butce = opts?.butceMs ?? 700_000;
  const simdi = opts?.simdi ?? new Date(); const gun = trGunu(simdi); const yil = Number(gun.slice(0, 4));
  const kalanMs = () => butce - (Date.now() - t0);
  const plan = syncBirimleri(yil, AYGIR_GRUPLARI, AYGIR_PISTLERI, KISRAK_BABASI_GRUPLARI);
  const sira = new Map(plan.map((b, i) => [birimAnahtari(b), i]));

  const sonuc: SyncSonuc = { gun, yil, durum: "DEVAM", buCalismada: [], kalan: 0, toplam: plan.length, gorunumAlindi: false };
  if (await db.tjkPedigriSnapshot.findUnique({ where: { snapshotDate: gun }, select: { id: true } })) return { ...sonuc, durum: "TAMAMLANDI-ZATEN" };

  await db.tjkPedigriSyncUnit.createMany({ data: plan.map((b) => ({ day: gun, kind: b.kind, year: b.year, groupId: b.groupId, pistId: b.pistId, status: "PENDING" })), skipDuplicates: true });
  await db.tjkPedigriSyncUnit.updateMany({ where: { day: gun, status: "RUNNING", startedAt: { lt: new Date(Date.now() - BAYAT_RUNNING_MS) } }, data: { status: "PENDING" } });

  for (;;) {
    const bekleyen = (await db.tjkPedigriSyncUnit.findMany({ where: { day: gun, status: "PENDING", attempts: { lt: MAKS_DENEME } } }))
      .sort((a, b) => (sira.get(birimAnahtari(a as SyncBirim)) ?? 999) - (sira.get(birimAnahtari(b as SyncBirim)) ?? 999));
    const birim = bekleyen[0]; if (!birim) break;
    if (kalanMs() < (birim.kind === "DAM" ? BIRIM_MIN_SURE_MS.DAM : BIRIM_MIN_SURE_MS.DEFAULT)) break; // bu çalışmada sığmaz → sonraki çalışmaya
    const al = await db.tjkPedigriSyncUnit.updateMany({ where: { id: birim.id, status: "PENDING" }, data: { status: "RUNNING", startedAt: new Date(), attempts: { increment: 1 }, error: null } });
    if (al.count !== 1) continue; // başka çalışma aldı
    const etiket = `${birim.kind} ${birim.year} g${birim.groupId} p${birim.pistId}`; const b0 = Date.now();
    try {
      const s = await fetchTjkPedigriStats(birim.kind as "SIRE" | "DAM" | "DAMSIRE", birim.year, { grup: birim.groupId, pist: birim.pistId });
      const uyari = cekimUyarilari.length ? cekimUyarilari.splice(0).slice(0, 3).join(" | ") : null;
      const deneme = birim.attempts + 1;
      if (!s.rows.length) {
        const bos = s.toplamTjk === 0;
        await db.tjkPedigriSyncUnit.update({ where: { id: birim.id }, data: { status: bos ? "DONE" : deneme >= MAKS_DENEME ? "HATA" : "PENDING", rowCount: 0, eksik: s.toplamTjk ?? null, finishedAt: new Date(), error: bos ? null : `satır yok (TJK toplam ${s.toplamTjk})${uyari ? " | " + uyari : ""}` } });
        sonuc.buCalismada.push({ birim: etiket, sonuc: bos ? "boş (TJK'da yok)" : "satır yok", satir: 0, sureSn: Math.round((Date.now() - b0) / 1000) }); continue;
      }
      const veri = s.rows.map((r) => ({ ...r }));
      const where = { kind: birim.kind, year: birim.year, groupId: birim.groupId, pistId: birim.pistId };
      if (s.eksik === 0) {
        // İşlem bloğu yok (pgbouncer P2028): veri TAM çekildikten SONRA silinip parça parça yazılır; yarıda kalırsa birim PENDING'e döner ve yeniden çekilir.
        await db.tjkPedigriStat.deleteMany({ where });
        for (let i = 0; i < veri.length; i += 500) await db.tjkPedigriStat.createMany({ data: veri.slice(i, i + 500), skipDuplicates: true });
        await db.tjkPedigriSyncUnit.update({ where: { id: birim.id }, data: { status: "DONE", rowCount: veri.length, eksik: 0, finishedAt: new Date(), error: uyari } });
        sonuc.buCalismada.push({ birim: etiket, sonuc: "tamam", satir: veri.length, sureSn: Math.round((Date.now() - b0) / 1000) });
      } else {
        // Eksik çekim: mevcut kayıtlar SİLİNMEZ, yalnız yeni satırlar eklenir; birkaç deneme sonra EKSIK olarak kabul edilir.
        await db.tjkPedigriStat.createMany({ data: veri, skipDuplicates: true });
        await db.tjkPedigriSyncUnit.update({ where: { id: birim.id }, data: { status: deneme >= MAKS_DENEME ? "EKSIK" : "PENDING", rowCount: veri.length, eksik: s.eksik, finishedAt: new Date(), error: `EKSİK ${s.eksik} (TJK toplam ${s.toplamTjk})${uyari ? " | " + uyari : ""}` } });
        sonuc.buCalismada.push({ birim: etiket, sonuc: `eksik ${s.eksik}`, satir: veri.length, sureSn: Math.round((Date.now() - b0) / 1000) });
      }
    } catch (e) {
      const hata = e instanceof Error ? e.message : String(e);
      await db.tjkPedigriSyncUnit.update({ where: { id: birim.id }, data: { status: birim.attempts + 1 >= MAKS_DENEME ? "HATA" : "PENDING", finishedAt: new Date(), error: hata.slice(0, 500) } }).catch(() => {});
      sonuc.buCalismada.push({ birim: etiket, sonuc: "hata: " + hata.slice(0, 120), satir: null, sureSn: Math.round((Date.now() - b0) / 1000) });
    }
  }

  const acik = await db.tjkPedigriSyncUnit.count({ where: { day: gun, OR: [{ status: "PENDING", attempts: { lt: MAKS_DENEME } }, { status: "RUNNING" }] } });
  sonuc.kalan = acik;
  if (acik === 0) { sonuc.gorunumAlindi = await gorunumAl(gun, yil); sonuc.durum = "TAMAMLANDI"; }
  return sonuc;
}

/** Cari yıl satırlarının sıkıştırılmış günlük görüntüsü. Eksik/hatalı birim sayısı notlara yazılır (görüntü yine de alınır: mevcut veri en iyi bilgidir). */
export async function gorunumAl(gun: string, yil: number): Promise<boolean> {
  if (await db.tjkPedigriSnapshot.findUnique({ where: { snapshotDate: gun }, select: { id: true } })) return false;
  const rows = await db.tjkPedigriStat.findMany({ where: { year: yil }, select: { kind: true, tjkId: true, year: true, groupId: true, pistId: true, normalizedName: true, breed: true, runnerCount: true, starts: true, wins: true, capturedAt: true } });
  if (!rows.length) return false;
  const ozet = await db.tjkPedigriSyncUnit.groupBy({ by: ["status"], where: { day: gun }, _count: { _all: true } });
  const satirlar: SnapSatir[] = rows.map((r) => [r.kind, r.tjkId, r.year, r.groupId, r.pistId, r.normalizedName, r.breed, r.runnerCount, r.starts, r.wins]);
  await db.tjkPedigriSnapshot.create({ data: { snapshotDate: gun, year: yil, capturedAt: new Date(Math.max(...rows.map((r) => r.capturedAt.getTime()))), rowCount: rows.length, notlar: "birimler: " + ozet.map((o) => `${o.status}=${o._count._all}`).join(" "), payload: Uint8Array.from(snapshotKodla(satirlar)) } });
  return true;
}
