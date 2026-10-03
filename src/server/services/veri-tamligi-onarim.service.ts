import { syncDereceIstatistikleri } from "@/server/services/ingest/tjk-derece-ist.adapter";
import { syncHorseStatsCache } from "@/server/services/ingest/tjk-at-profil.adapter";
import { db } from "@/lib/db";

/**
 * 2026-08-30 kullanıcı talebi ("otomatik bir script tasarla ... eksiklik farkettiğinde
 * tamamlayacak"): /admin/veri-tamligi'nin 8 alanından YALNIZ biri için — Derece
 * İstatistikleri (TjkDereceKaydi) — bu tür bir otomatik onarım hem GÜVENLİ hem
 * ANLAMLI. Sebebi: bugün KANITLANDI ki bu alan gerçekten (ve sessizce) 5 gün boyunca
 * güncellenmeden kalabiliyor (sync-derece-ist Vercel'e hiç kaydolmadığı için
 * sync-trainer-stats'a asalak eklenmişti, hatası Promise.allSettled ile yutuluyordu) —
 * ve syncDereceIstatistikleri idempotent (upsert) olduğu için tekrar tekrar
 * çağrılması ZARARSIZ.
 *
 * 2026-08-30 (AYNI GÜN, İKİNCİ TUR) — kullanıcı "%100 veya yakın olmalı, hepsine bak"
 * dedikten sonra kalan satırlar tek tek yeniden araştırıldı, ikisi daha kapsam dışından
 * çıkarıldı:
 * - HP (handikap puanı): asıl bug bulundu — Postgres regex motorunda \b kelime sınırı
 *   değil BACKSPACE karakteri demek, üstüne TS template literal'de tek ters eğik çizgi
 *   JS tarafından yutuluyordu. veri-tamligi.service.ts'teki regex düzeltildi (%91→%98),
 *   kalan boşluk artık gerçekten yapısal (debüt atlar) — burada onarılacak bir şey yok.
 * - AGF Trend / AGF (güncel): "Son 7 Gün" düşüşü, paydaya henüz koşulmamış bugün/yarın
 *   yarışlarının girmesinden kaynaklanıyordu (bu yarışlarda AGF fiziksel olarak var
 *   olamaz) — bu da veri-tamligi.service.ts'te yapısal-muafiyet olarak düzeltildi
 *   (%75.5→%98.7). Bir SENKRON sorunu değildi, burada onarılacak bir şey yok.
 * - At profil önbelleği: GERÇEK ve fixable bulundu — bkz. atProfiliniKontrolEtVeOnar.
 *
 * HÂLÂ BİLEREK KAPSAM DIŞI BIRAKILAN alanlar:
 * - Galop: 2 aydır sabit ~%85, tüm dönem boyunca dengeli dağılmış (ne yakın geçmişte
 *   bozulmuş ne de belirli bir tarihte başlamış) — muhtemelen gerçek tavan (TJK'da her
 *   koşudan önce her at için galop/idman kaydı YOK, trainer'lar seçici bildiriyor).
 *   Kanıtlanmış bir sync bug'ı yok, "onarım" kavramı buraya henüz uymuyor.
 * - Pedigri önbelleği, tjkAtId, At yarış geçmişi önbelleği: zaten %99-100, onarım
 *   gerektirecek anlamlı bir boşluk yok.
 *
 * Yeni bir alan eklenmek istenirse: aynı desen — (1) getVeriTamligiRaporu'ndan o alanın
 * GERÇEKTEN periyodik/sessiz-başarısızlığa açık olduğu kanıtlanmalı, (2) o alanın
 * mevcut sync fonksiyonunun idempotent olduğu doğrulanmalı, (3) buraya eklenmeli.
 */
export type VeriTamligiOnarimSonucu = {
  kontrolEdildi: boolean;
  onarimGerekliMiydi: boolean;
  detay?: Record<string, number>;
  hata?: string;
};

// 2026-08-30 DÜZELTME: ilk tasarım "son 7 günde kaç FARKLI gün updatedAt gördü" ölçüyordu
// — ama bir defalık toplu backfill (bugün yaptığımız gibi) TÜM satırları TEK bir günde
// güncelliyor, bu da "yalnız 1/7 gün aktif" gibi görünüp gereksiz yere tekrar tekrar
// onarımı tetikliyordu (yanlış pozitif). Doğru ölçüt: arşivdeki EN GÜNCEL koşu tarihi
// bugüne ne kadar yakın — bu, toplu/günlük senkron farkı gözetmeden "veri ne kadar geride
// kaldı" sorusuna doğrudan cevap verir.
const MAKS_GECIKME_GUN = 2;

export async function dereceIstatistikleriniKontrolEtVeOnar(): Promise<VeriTamligiOnarimSonucu> {
  const enSon = await db.tjkDereceKaydi.findFirst({ orderBy: { tarih: "desc" }, select: { tarih: true } });
  const gecikmeGun = enSon?.tarih ? (Date.now() - enSon.tarih.getTime()) / (24 * 60 * 60 * 1000) : Infinity;
  const onarimGerekli = gecikmeGun > MAKS_GECIKME_GUN;

  if (!onarimGerekli) {
    return { kontrolEdildi: true, onarimGerekliMiydi: false };
  }

  try {
    const sonuc = await syncDereceIstatistikleri(new Date().getUTCFullYear());
    return { kontrolEdildi: true, onarimGerekliMiydi: true, detay: sonuc };
  } catch (e) {
    return { kontrolEdildi: true, onarimGerekliMiydi: true, hata: e instanceof Error ? e.message : String(e) };
  }
}

// 2026-08-30 kullanıcı bulgusu: "At profil önbelleği" 2026-08-24 civarından beri gerçek bir
// backlog sorunu yaşıyordu — günlük sync-horse-stats-cache cron'u (kendi 250'lik kotasıyla)
// zaten TAMAMEN eksik atları önceliklendirecek şekilde düzeltildi (bkz. tjk-at-profil.adapter.ts
// syncHorseStatsCache). Bu fonksiyon o günlük kotanın YETERSİZ kaldığı durumlarda (backlog
// büyükse) EK bir senkron turu tetikleyen bir güvenlik ağı — normal günlerde onarimGerekli
// false döner, günlük cron zaten yetiyordur.
const AT_PROFIL_ESIK = 30;
const AT_PROFIL_EKSTRA_LIMIT = 400;

export async function atProfiliniKontrolEtVeOnar(): Promise<VeriTamligiOnarimSonucu> {
  const yediGunOnce = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const ikiGunSonra = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const rows = await db.$queryRaw<{ eksik: bigint }[]>`
    SELECT count(DISTINCT r."tjkAtId") as eksik
    FROM "Runner" r
    JOIN "Race" ra ON ra.id = r."raceId"
    JOIN "RaceDay" rd ON rd.id = ra."raceDayId"
    JOIN "Hippodrome" h ON h.id = rd."hippodromeId"
    LEFT JOIN "HorseStatsCache" hs ON hs."tjkAtId" = r."tjkAtId"
    WHERE r.scratched = false AND r."tjkAtId" IS NOT NULL
      AND rd.date >= ${yediGunOnce} AND rd.date <= ${ikiGunSonra}
      AND h.slug NOT IN ('karma', 'perak-malezya')
      AND hs."tjkAtId" IS NULL
  `;
  const eksik = Number(rows[0]?.eksik ?? 0);
  const onarimGerekli = eksik > AT_PROFIL_ESIK;

  if (!onarimGerekli) {
    return { kontrolEdildi: true, onarimGerekliMiydi: false, detay: { eksikSayisi: eksik } };
  }

  try {
    const sonuc = await syncHorseStatsCache(AT_PROFIL_EKSTRA_LIMIT, 3);
    return {
      kontrolEdildi: true,
      onarimGerekliMiydi: true,
      detay: { eksikSayisiOncesi: eksik, ok: sonuc.ok, fail: sonuc.fail, remaining: sonuc.remaining },
    };
  } catch (e) {
    return { kontrolEdildi: true, onarimGerekliMiydi: true, hata: e instanceof Error ? e.message : String(e) };
  }
}
