// RCA Tamamlanma Bildirimi + ROOT_SUBCAUSE kalıcı kaydı — 2026-10-10 kullanıcı talebi:
// "her yaptığı rca sonrası bu koşu rca analizi yapılmıştır diye bildirim gelmedi... bu
// şekilde kendi kendine yapabilmesi gerek ben söylemeden". Mevcut Notification altyapısı
// (schema.prisma'daki Notification modeli, admin/bildirimler sayfası, NotificationBell)
// AYNEN kullanılıyor — yeni bir bildirim sistemi icat edilmedi.
//
// İzole raw-SQL tablo (RcaScanSnapshot/TempCalShadowObservation ile AYNI desen):
// schema.prisma'ya eklenmez. Idempotency: (raceId, homeKuponId veya raceId-tek-HIT) için
// TEK satır — notifiedAt NULL'sa bildirim gönderilir ve DOLDURULUR; cron tekrar çalışırsa
// (aynı rcaVersion, aynı eventType/rootSubcause) hiçbir şey göndermez. Sonuç DEĞİŞİRSE
// (eventType veya rootSubcause farklı) ayrı bir "RCA güncellendi" bildirimi (updateNotifiedAt).
import { db } from "@/lib/db";
import { kosuKayitlari, kuponKayitlari, kuponSatirlari, yarisHesapla } from "./kosu-sonuc-degerlendirme.service";
import { tespitRootSubcause, type GroupSubcauseSonucu } from "./rca-root-subcause.service";

const RCA_NOTIFY_VERSION = "rca-notify-v1";

export async function ensureRcaSubcauseTable(): Promise<void> {
  await db.$executeRaw`
    CREATE TABLE IF NOT EXISTS "RcaRootSubcauseEvent" (
      "id"               TEXT NOT NULL PRIMARY KEY,
      "raceId"           TEXT NOT NULL,
      "homeKuponId"      TEXT,
      "rcaVersion"       TEXT NOT NULL,
      "tarih"            DATE NOT NULL,
      "hipodrom"         TEXT NOT NULL,
      "raceNo"           INTEGER NOT NULL,
      "winnerNo"         INTEGER NOT NULL,
      "winnerAd"         TEXT,
      "eventType"        TEXT NOT NULL,
      "rootSubcause"     TEXT NOT NULL,
      "evidenceJson"     JSONB NOT NULL DEFAULT '{}',
      "notifiedAt"       TIMESTAMPTZ(3),
      "updateNotifiedAt" TIMESTAMPTZ(3),
      "createdAt"        TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
      "updatedAt"        TIMESTAMPTZ(3) NOT NULL DEFAULT now()
    )
  `;
  // homeKuponId NULL olabilir (HIT-özet satırı, grup bazlı değil) — COALESCE ile tekilleştir.
  await db.$executeRaw`
    CREATE UNIQUE INDEX IF NOT EXISTS "RcaRootSubcauseEvent_race_kupon_key"
      ON "RcaRootSubcauseEvent" ("raceId", (COALESCE("homeKuponId", 'RACE_LEVEL')))
  `;
  await db.$executeRaw`CREATE INDEX IF NOT EXISTS "RcaRootSubcauseEvent_tarih_idx" ON "RcaRootSubcauseEvent" ("tarih" DESC)`;
}

const EVENT_TYPE_LABEL: Record<string, string> = {
  HIT: "Hit — sorun tespit edilmedi",
  PUBLISH_OVERRIDE_MISS: "PUBLISH_OVERRIDE_MISS",
  ALLOCATOR_MISS: "ALLOCATOR_MISS",
  ANALYSIS_MISS: "ANALYSIS_MISS",
  NO_DATA: "Veri yetersiz",
};
const SUBCAUSE_LABEL: Record<string, string> = {
  TIER_FLOOR_LOCK: "kademe-taban kilidi", BUDGET_WIDTH: "daha geniş kademe yakalardı",
  TRUE_SURPRISE: "gerçek sürpriz", MARKET_SUPPRESSED_RESCUE3: "piyasa bastırmış (RESCUE3)",
  MARKET_SUPPRESSED_RESCUE6: "piyasa bastırmış (RESCUE6)", MODEL_BLIND: "model/piyasa görmüş ama kaçmış",
  MANUAL_EDIT: "elle düzenleme", UNKNOWN: "kanıtlanamadı", NOT_APPLICABLE: "",
};

async function notifyAdmins(title: string, body: string, link: string): Promise<void> {
  const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  if (admins.length === 0) return;
  await db.notification.createMany({ data: admins.map((a) => ({ userId: a.id, type: "SYSTEM" as const, title, body, link })) });
}

async function upsertVeBildir(params: {
  raceId: string; homeKuponId: string | null; tarih: string; hipodrom: string; raceNo: number;
  winnerNo: number; winnerAd: string | null; eventType: string; rootSubcause: string; evidence: unknown;
}): Promise<"yeni" | "guncellendi" | "sessiz"> {
  const mevcut = await db.$queryRaw<{ id: string; eventType: string; rootSubcause: string; notifiedAt: Date | null }[]>`
    SELECT "id","eventType","rootSubcause","notifiedAt" FROM "RcaRootSubcauseEvent"
    WHERE "raceId" = ${params.raceId} AND COALESCE("homeKuponId",'RACE_LEVEL') = ${params.homeKuponId ?? "RACE_LEVEL"}
  `;
  const id = `rcasc_${params.raceId}_${params.homeKuponId ?? "race"}`;
  const degisti = mevcut[0] && (mevcut[0].eventType !== params.eventType || mevcut[0].rootSubcause !== params.rootSubcause);
  const yeni = !mevcut[0];

  await db.$executeRaw`
    INSERT INTO "RcaRootSubcauseEvent" ("id","raceId","homeKuponId","rcaVersion","tarih","hipodrom","raceNo","winnerNo","winnerAd","eventType","rootSubcause","evidenceJson")
    VALUES (${id}, ${params.raceId}, ${params.homeKuponId}, ${RCA_NOTIFY_VERSION}, ${params.tarih}::date, ${params.hipodrom}, ${params.raceNo}, ${params.winnerNo}, ${params.winnerAd}, ${params.eventType}, ${params.rootSubcause}, ${JSON.stringify(params.evidence)}::jsonb)
    ON CONFLICT ("raceId", (COALESCE("homeKuponId",'RACE_LEVEL'))) DO UPDATE SET
      "eventType" = EXCLUDED."eventType", "rootSubcause" = EXCLUDED."rootSubcause", "evidenceJson" = EXCLUDED."evidenceJson", "updatedAt" = now()
  `;

  const altBaslik = params.eventType === "HIT" ? "" : ` · ${EVENT_TYPE_LABEL[params.eventType] ?? params.eventType}${SUBCAUSE_LABEL[params.rootSubcause] ? "/" + SUBCAUSE_LABEL[params.rootSubcause] : ""}`;
  const body = params.eventType === "HIT"
    ? `#${params.winnerNo} ${params.winnerAd ?? ""} — Hit / sorun tespit edilmedi`
    : `#${params.winnerNo} ${params.winnerAd ?? ""}${altBaslik}`;
  const link = `/admin/root-cause?raceId=${params.raceId}`;
  const grupEtiketi = params.homeKuponId ? "" : "";

  if (yeni) {
    await notifyAdmins(`${params.hipodrom} ${params.raceNo}. Koşu RCA analizi tamamlandı${grupEtiketi}`, body, link);
    await db.$executeRaw`UPDATE "RcaRootSubcauseEvent" SET "notifiedAt" = now() WHERE "id" = ${id}`;
    return "yeni";
  } else if (degisti) {
    await notifyAdmins(`${params.hipodrom} ${params.raceNo}. Koşu RCA güncellendi`, body, link);
    await db.$executeRaw`UPDATE "RcaRootSubcauseEvent" SET "updateNotifiedAt" = now() WHERE "id" = ${id}`;
    return "guncellendi";
  }
  // yeni=false VE degisti=false → sessiz (idempotent, tekrar bildirim YOK — kullanıcı kuralı).
  return "sessiz";
}

/** Son `gunSayisi` gündeki, sonuçlanmış+published yarışları tarar: HIT ise tek (ucuz)
 *  bildirim, MISS ise tespitRootSubcause (BASE replay + allocator karşı-olgusal + market/
 *  fundamental ayrımı) çalıştırıp HER HomeKupon grubu için ayrı kayıt+bildirim üretir. */
export async function calistirRcaBildirimTaramasi(gunSayisi = 3): Promise<{ islenenKosu: number; yeniBildirim: number; guncellemeBildirimi: number }> {
  await ensureRcaSubcauseTable();
  const kayitlar = await kosuKayitlari();
  const kuponlarHam = await kuponKayitlari();
  const fromDate = new Date(); fromDate.setUTCDate(fromDate.getUTCDate() - gunSayisi);
  const fromStr = fromDate.toISOString().slice(0, 10);

  let islenenKosu = 0, yeniSayac = 0, guncelSayac = 0;
  const sayacliBildir = async (p: Parameters<typeof upsertVeBildir>[0]) => {
    const sonuc = await upsertVeBildir(p);
    if (sonuc === "yeni") yeniSayac++;
    else if (sonuc === "guncellendi") guncelSayac++;
  };

  for (const k of kayitlar) {
    const tarih = k.raceDay.date.toISOString().slice(0, 10);
    if (tarih < fromStr) continue;
    const satirlar = kuponSatirlari(kuponlarHam, k.raceDay.hippodrome.name, tarih, k.raceNo);
    const y = yarisHesapla(k, satirlar);
    if (!y) continue;
    if (y.kayipTipi === "KUPON_KAPSAMI_YOK" || y.kayipTipi === "OLCULMEDI") continue; // belirsiz, HIT/MISS değil — bildirim üretme
    islenenKosu++;

    // 2026-10-10 kullanıcı bulgusu (Ankara K6/PERCY JACKSON) — y.kayipTipi, kuponSatirlari'nin
    // TÜM grupları (1.Altılı/2.Altılı/7'li) BİRLEŞTİRİP (OR mantığıyla) hesapladığı bir özet:
    // kazanan SADECE 1.Altılı'da seçilmiş olsa bile y.kayipTipi="OK" (HIT) çıkıyordu — 2.Altılı/
    // 7'li'deki GERÇEK PUBLISH_OVERRIDE_MISS'i tamamen GİZLİYORDU. Bu yüzden y.kayipTipi burada
    // yalnız "bu koşu bir sonuca/kupona bağlı mı" filtresi için kullanılıyor — HIT/MISS kararı
    // HER ZAMAN tespitRootSubcause'un GRUP BAZLI (kuponSatirlari aggregate'inden BAĞIMSIZ,
    // HomeKupon kaydı başına ayrı) sonucundan geliyor.
    let gruplar: GroupSubcauseSonucu[];
    try { gruplar = await tespitRootSubcause(y.raceId, y.kazananNo); } catch { gruplar = []; }

    if (gruplar.length === 0) {
      await sayacliBildir({ raceId: y.raceId, homeKuponId: null, tarih, hipodrom: y.hipodrom, raceNo: y.raceNo, winnerNo: y.kazananNo, winnerAd: y.kazananAd, eventType: "NO_DATA", rootSubcause: "NOT_APPLICABLE", evidence: {} });
      continue;
    }
    const missGruplari = gruplar.filter((g) => g.eventType !== "HIT");
    if (missGruplari.length === 0) {
      // TÜM gruplarda hit — tek, özet bir HIT bildirimi yeterli.
      await sayacliBildir({ raceId: y.raceId, homeKuponId: null, tarih, hipodrom: y.hipodrom, raceNo: y.raceNo, winnerNo: y.kazananNo, winnerAd: y.kazananAd, eventType: "HIT", rootSubcause: "NOT_APPLICABLE", evidence: {} });
      continue;
    }
    // En az bir grup MISS — HER grup kendi kaydını/bildirimini alır (K6'daki gibi AYNI at
    // bir grupta hit, başka bir grupta miss olabilir; ikisi de ayrı ayrı doğru raporlanmalı).
    for (const g of missGruplari) {
      await sayacliBildir({ raceId: y.raceId, homeKuponId: g.homeKuponId, tarih, hipodrom: y.hipodrom, raceNo: y.raceNo, winnerNo: y.kazananNo, winnerAd: y.kazananAd, eventType: g.eventType, rootSubcause: g.rootSubcause, evidence: g.evidence });
    }
  }
  return { islenenKosu, yeniBildirim: yeniSayac, guncellemeBildirimi: guncelSayac };
}
