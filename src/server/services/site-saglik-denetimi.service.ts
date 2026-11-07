import { db } from "@/lib/db";
import { syncHorseStatsCache } from "@/server/services/ingest/tjk-at-profil.adapter";
import { syncResultsForDate } from "@/server/services/result-sync";
import { syncAgfForDate } from "@/server/services/agf-sync";
import { syncAccuraceForDate } from "@/server/services/accurace-sync.service";
import { toTjkDate, ingestDate } from "@/server/services/ingest/tjk-info.adapter";
import { turkeyDateString, toTurkeyWallClock } from "@/lib/tz";

/**
 * 2026-11-07 kullanıcı talebi: "siteyi kontrol etsin, aksayan yerlerde müdahale etsin".
 * veri-tamligi-onarim.service.ts'teki KANITLANMIŞ desenin ("tespit et → mevcut idempotent
 * sync fonksiyonunu tekrar çağır") devamı — yeni icat edilen bir müdahale mekanizması YOK,
 * sadece kapsam genişletildi. Standing kural (feedback_otomatik_stale_reddedildi): bu
 * fonksiyonlar YAYINDAKİ içeriği/tahminleri asla otomatik gizlemez/değiştirmez — sadece
 * veri boru hattını (okuma+yazma, tamamen idempotent, zararsız tekrar) onarır. Gerçek bir
 * altyapı kesintisi (Vercel/DB çöküşü) bu katmanda "onarılamaz" — o durumda tek müdahale
 * admin'e bildirimdir (Notification tablosu, rca-notification.service.ts ile AYNI desen).
 */
export type SaglikSonucu = {
  kontrolEdildi: boolean;
  sorunVarMiydi: boolean;
  onarildiMi?: boolean;
  detay?: Record<string, unknown>;
  hata?: string;
};

async function bildirAdminlere(title: string, body: string, link: string): Promise<void> {
  const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  if (admins.length === 0) return;
  await db.notification.createMany({ data: admins.map((a) => ({ userId: a.id, type: "SYSTEM" as const, title, body, link })) });
}

// 2026-11-07 bulgusu: HorseRaceHistoryCache (hızDerecesi + zeminMesafeDeneyimi'nin kaynağı)
// yakın vadede koşacak atlarda bile sessizce bayatlayabiliyor — bkz. tjk-at-profil.adapter.ts
// syncHorseStatsCache'teki öncelik sırası notu. staleDays=3 SENKRON FONKSİYONUNUN KENDİ
// eşiğiyle AYNI — "senkron zaten taze kabul ediyor ama biz ekstra kontrol ediyoruz" tutarsızlığı
// olmasın diye.
const HISTORY_CACHE_STALE_DAYS = 3;
const HISTORY_CACHE_ESIK = 20;

export async function historyCacheTazeliginiKontrolEtVeOnar(): Promise<SaglikSonucu> {
  try {
    const now = new Date();
    const in2days = new Date(now.getTime() + 2 * 86_400_000);
    const staleCutoff = new Date(now.getTime() - HISTORY_CACHE_STALE_DAYS * 86_400_000);

    const runners = await db.runner.findMany({
      where: {
        scratched: false,
        tjkAtId: { not: null },
        race: { raceDay: { date: { gte: new Date(turkeyDateString()), lte: in2days } }, result: { is: null } },
      },
      select: { tjkAtId: true },
      distinct: ["tjkAtId"],
    });
    if (runners.length === 0) return { kontrolEdildi: true, sorunVarMiydi: false };

    const ids = runners.map((r) => r.tjkAtId!);
    const taze = await db.horseRaceHistoryCache.count({ where: { tjkAtId: { in: ids }, updatedAt: { gte: staleCutoff } } });
    const bayat = ids.length - taze;

    if (bayat <= HISTORY_CACHE_ESIK) {
      return { kontrolEdildi: true, sorunVarMiydi: false, detay: { yakinVadeAt: ids.length, bayat } };
    }

    const sonuc = await syncHorseStatsCache(400, HISTORY_CACHE_STALE_DAYS);
    return { kontrolEdildi: true, sorunVarMiydi: true, onarildiMi: true, detay: { yakinVadeAt: ids.length, bayatOncesi: bayat, sync: sonuc } };
  } catch (e) {
    return { kontrolEdildi: true, sorunVarMiydi: true, hata: e instanceof Error ? e.message : String(e) };
  }
}

// 2026-11-08 kullanıcı bulgusu: sync-accurace-daily + result-sync'in piggyback'i Accurace'i
// yalnız "bugün" ve "dün" için deniyor — Accurace bir yarışın verisini normalden daha
// gecikmeli (2-7+ gün) yayınlarsa sistemimiz BİR DAHA ASLA denemiyor, veri gerçekten var
// olsa da kalıcı olarak kaçırılıyor ("TJK'da yok" ile "biz çekemedik" farklı, kullanıcı
// vurgusu). "459 koşu" tek seferlik backfill ile kapatıldı ama bu AYNI boşluk her gün
// yeniden açılıyor — bu yüzden tek seferlik değil, kalıcı/tekrarlayan bir kontrol gerekiyor.
// syncAccuraceForDate zaten yalnız accuraceRace:null koşuları işlediği için tekrar
// çağırmak tamamen zararsız/idempotent.
const ACCURACE_GUNCE_PENCERE = 7;

export async function accuraceKapsamKontrolEtVeOnar(): Promise<SaglikSonucu> {
  try {
    const bugun = new Date(turkeyDateString());
    const gunler: string[] = [];
    for (let i = 1; i <= ACCURACE_GUNCE_PENCERE; i++) {
      gunler.push(new Date(bugun.getTime() - i * 86_400_000).toISOString().slice(0, 10));
    }

    const eksikGunSayisi = await db.race.groupBy({
      by: ["raceDayId"],
      where: {
        accuraceRace: null,
        raceDay: { date: { in: gunler.map((g) => new Date(g)) }, hippodrome: { slug: { notIn: ["karma", "perak-malezya"] } } },
      },
      _count: true,
    });
    if (eksikGunSayisi.length === 0) return { kontrolEdildi: true, sorunVarMiydi: false };

    let toplamKaydedilen = 0, toplamAtlanan = 0;
    for (const dateStr of gunler) {
      const sonuc = await syncAccuraceForDate(dateStr).catch(() => ({ kaydedilen: 0, atlanan: 0, errors: [] as string[] }));
      toplamKaydedilen += sonuc.kaydedilen;
      toplamAtlanan += sonuc.atlanan;
    }
    return { kontrolEdildi: true, sorunVarMiydi: true, onarildiMi: true, detay: { eksikGunSayisi: eksikGunSayisi.length, kaydedilen: toplamKaydedilen, atlanan: toplamAtlanan } };
  } catch (e) {
    return { kontrolEdildi: true, sorunVarMiydi: true, hata: e instanceof Error ? e.message : String(e) };
  }
}

// AGF senkronu (günde 4 kez, 09/12/15/18 UTC) aktif saatlerde (TR 10:00-23:00) 6 saatten
// uzun süre hiç yeni AgfSnapshot üretmemişse muhtemelen takılmış/hata yutuluyor demektir.
export async function agfSenkronuKontrolEtVeOnar(): Promise<SaglikSonucu> {
  try {
    const trSaat = toTurkeyWallClock(new Date()).getHours();
    if (trSaat < 10 || trSaat >= 23) return { kontrolEdildi: true, sorunVarMiydi: false, detay: { not: "aktif saat dışı" } };

    const altiSaatOnce = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const sonSnapshot = await db.agfSnapshot.findFirst({ orderBy: { capturedAt: "desc" }, select: { capturedAt: true } });
    const takiliMi = !sonSnapshot || sonSnapshot.capturedAt < altiSaatOnce;

    if (!takiliMi) return { kontrolEdildi: true, sorunVarMiydi: false };

    const sonuc = await syncAgfForDate(new Date());
    const total = sonuc.cities.reduce((s, c) => s + c.runnersUpdated, 0);
    return { kontrolEdildi: true, sorunVarMiydi: true, onarildiMi: true, detay: { sonSnapshot: sonSnapshot?.capturedAt ?? null, runnersUpdated: total } };
  } catch (e) {
    return { kontrolEdildi: true, sorunVarMiydi: true, hata: e instanceof Error ? e.message : String(e) };
  }
}

// Program ingest (günde 3 kez) tamamen düşerse bugünün RaceDay/Race kaydı hiç oluşmaz.
export async function programIngestKontrolEtVeOnar(): Promise<SaglikSonucu> {
  try {
    const trSaat = toTurkeyWallClock(new Date()).getHours();
    if (trSaat < 12) return { kontrolEdildi: true, sorunVarMiydi: false, detay: { not: "henüz çok erken" } };

    const bugun = new Date(turkeyDateString());
    const raceCount = await db.race.count({ where: { raceDay: { date: bugun } } });
    if (raceCount > 0) return { kontrolEdildi: true, sorunVarMiydi: false, detay: { raceCount } };

    const sonuc = await ingestDate(toTjkDate(new Date()));
    const yeniRaceCount = await db.race.count({ where: { raceDay: { date: bugun } } });
    return { kontrolEdildi: true, sorunVarMiydi: true, onarildiMi: yeniRaceCount > 0, detay: { sonuc, yeniRaceCount } };
  } catch (e) {
    return { kontrolEdildi: true, sorunVarMiydi: true, hata: e instanceof Error ? e.message : String(e) };
  }
}

// Sonuç senkronu (5dk'da bir, 11-21 UTC) — bugün başlama saati 2.5 saatten fazla geçmiş,
// yayınlanmış ama hâlâ sonuçsuz (ve PendingResult'ta da yok — o zaten "görüldü ama
// belirsiz" durumunu işaretler, burada yanlış-pozitif üretmesin) yarış var mı. Tek
// müdahale: senkronu TEKRAR çağırmak (idempotent) — hâlâ eksikse (TJK'da gerçekten
// henüz yayınlanmamış/ertelenmiş olabilir) ZORLAMA yapılmaz, admin'e bildirilir.
export async function sonucSenkronuKontrolEtVeOnar(): Promise<SaglikSonucu> {
  try {
    const bugun = new Date(turkeyDateString());
    const simdiDk = (() => { const w = toTurkeyWallClock(new Date()); return w.getHours() * 60 + w.getMinutes(); })();

    const adaylar = await db.race.findMany({
      where: {
        raceDay: { date: bugun },
        prediction: { published: true },
        result: { is: null },
        pendingResult: { is: null },
        time: { not: null },
      },
      select: { id: true, time: true, raceNo: true, raceDay: { select: { hippodrome: { select: { name: true } } } } },
    });
    const gecikmis = adaylar.filter((r) => {
      const [h, m] = (r.time ?? "").split(":").map(Number);
      if (Number.isNaN(h) || Number.isNaN(m)) return false;
      return simdiDk - (h * 60 + m) > 150;
    });

    if (gecikmis.length === 0) return { kontrolEdildi: true, sorunVarMiydi: false, detay: { adaySayisi: adaylar.length } };

    await syncResultsForDate(turkeyDateString());
    const hâlâEksik = await db.race.count({ where: { id: { in: gecikmis.map((r) => r.id) }, result: { is: null } } });

    if (hâlâEksik > 0) {
      await bildirAdminlere(
        "Sonuç senkronu gecikmiş olabilir",
        `${hâlâEksik} koşunun başlama saati 2.5+ saat geçti ama sonuç hâlâ yok (senkron tekrar denendi). Örn: ${gecikmis.slice(0, 3).map((r) => `${r.raceDay.hippodrome.name} K${r.raceNo}`).join(", ")}`,
        "/admin/veri-tamligi"
      );
    }
    return { kontrolEdildi: true, sorunVarMiydi: true, onarildiMi: hâlâEksik === 0, detay: { gecikmisOncesi: gecikmis.length, halaEksik: hâlâEksik } };
  } catch (e) {
    return { kontrolEdildi: true, sorunVarMiydi: true, hata: e instanceof Error ? e.message : String(e) };
  }
}

// Site erişilebilirliği — bu katmanda GERÇEK bir Vercel/DB kesintisi "onarılamaz" (bu
// fonksiyonun kendisi de aynı platformda çalışıyor); tek anlamlı müdahale admin'e DERHAL
// bildirmek. Aynı anormal durumu art arda her çalıştığında tekrar bildirmemek için 30
// dakikalık sessiz pencere (son SYSTEM bildirimi bu başlıkla ne zaman gönderilmiş).
export async function siteErisilebilirligeiKontrolEt(): Promise<SaglikSonucu> {
  const baslik = "Site erişilemiyor";
  try {
    const res = await fetch("https://rotaganyan.com/", { signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (res.ok) return { kontrolEdildi: true, sorunVarMiydi: false, detay: { status: res.status } };

    const sonBildirim = await db.notification.findFirst({ where: { title: baslik }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
    if (!sonBildirim || Date.now() - sonBildirim.createdAt.getTime() > 30 * 60 * 1000) {
      await bildirAdminlere(baslik, `Ana sayfa HTTP ${res.status} döndürdü — bu katman onaramaz, platform/DB durumu manuel kontrol edilmeli.`, "/");
    }
    return { kontrolEdildi: true, sorunVarMiydi: true, onarildiMi: false, detay: { status: res.status } };
  } catch (e) {
    const sonBildirim = await db.notification.findFirst({ where: { title: baslik }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
    if (!sonBildirim || Date.now() - sonBildirim.createdAt.getTime() > 30 * 60 * 1000) {
      await bildirAdminlere(baslik, `Ana sayfaya istek atılamadı: ${e instanceof Error ? e.message : String(e)}`, "/").catch(() => {});
    }
    return { kontrolEdildi: true, sorunVarMiydi: true, onarildiMi: false, hata: e instanceof Error ? e.message : String(e) };
  }
}
