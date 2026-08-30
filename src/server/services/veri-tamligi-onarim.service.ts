import { syncDereceIstatistikleri } from "@/server/services/ingest/tjk-derece-ist.adapter";
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
 * BİLEREK KAPSAM DIŞI BIRAKILAN alanlar (veri-tamligi.service.ts'teki diğer 7 satır):
 * - HP (handikap puanı): ~%9'luk kalan boşluk yapısal olabilir (debüt atlar zaten
 *   payda dışı) — "tamamlama" kavramı buraya uymuyor, önce ayrıca araştırılmalı.
 * - AGF Trend / AGF (güncel) / At profil önbelleği: "Son 7 Gün" düşüşü bugün/yarının
 *   (henüz olmamış koşuların) doğal artefaktı olduğu doğrulandı — zaten kendiliğinden
 *   dolacak, zorla yeniden senkronlamak gereksiz/anlamsız.
 * - Galop, Pedigri önbelleği, tjkAtId, At yarış geçmişi önbelleği: henüz bu oturumda
 *   "gerçekten fixable mi" diye ayrı ayrı doğrulanmadı — sahte bir onarım vaadi
 *   vermemek için şimdilik dahil edilmedi.
 *
 * Yeni bir alan eklenmek istenirse: aynı desen — (1) getVeriTamligiRaporu'ndan o alanın
 * GERÇEKTEN periyodik/sessiz-başarısızlığa açık olduğu kanıtlanmalı, (2) o alanın
 * mevcut sync fonksiyonunun idempotent olduğu doğrulanmalı, (3) buraya eklenmeli.
 */
export type VeriTamligiOnarimSonucu = {
  kontrolEdildi: boolean;
  onarimGerekliMiydi: boolean;
  detay?: { toplamSayfa: number; kayitSayisi: number; hataSayfaSayisi: number };
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
