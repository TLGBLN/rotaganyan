"use server";

/**
 * "Tempo Taşıma Gücü" — bir atın, Accurace'ın kendi GEÇMİŞ yarışlarındaki 100m'lik
 * checkpoint verisinden ölçülen, YARIŞIN SON 800m'sinde o yarıştaki EN İYİ atına göre ne
 * kadar geride kaldığının (saniye) ortalaması — düşük fark = tempoyu iyi taşıyor (dağılmıyor),
 * yüksek fark = erken enerjisini harcayıp geride kalıyor. Kullanıcının 2026-09-11 tarifiyle:
 * "1→1→1→8 ile 1→1→1→1 aynı Kaçak değildir" — bu sinyal tam olarak o farkı, POZİSYON değil
 * SÜRE üzerinden ölçüyor (pozisyon saha büyüklüğüne göre değişken, süre farkı değil).
 *
 * DOĞRULAMA (2026-09-11, GERÇEK backtest, n=1424, GEÇMİŞ veriyle — leak yok):
 * Geçmiş "tempo taşıma gücü" dilimlendiğinde kazanma oranı temiz biçimde ayrışıyor:
 * %18.8 → %10.7 → %6.2 → %4.2 (en iyi taşıyan dilimden en kötüye). ZATEN CANLI olan
 * yarisGidisatiSkoru ile korelasyonu neredeyse sıfır (r=0.002) — bağımsız bilgi taşıyor.
 * AGF (piyasa) ile orta düzey korele (r=-0.277) — havuzlanmış etkinin bir kısmı piyasanın
 * zaten bildiği şey, ama yarisGidisatiSkoru'nun HER diliminde de hâlâ ayrışma var (bkz.
 * proje hafızası: project_accurace_tempo_yarisgidisati.md).
 *
 * KRİTİK TASARIM NOTU (kendi hatamdan ders — bkz. proje hafızası): bu hesap SADECE
 * atın kendi GEÇMİŞ (cutoffTarihi'nden ÖNCEKİ) yarışlarını kullanır. Aynı yarışın kendi
 * checkpoint verisini o yarışın SONUCUNU tahmin etmek için kullanmak totolojiye yakın
 * (finishPlace zaten checkpoint'lerden türetiliyor) — o hata bu fonksiyona GİRMEDEN
 * yakalanıp düzeltildi.
 *
 * zemin-toleransi.actions.ts ile AYNI desen: isim eşleştirme (AccuraceHorseSplit.horseName),
 * leak-free cutoff, veri yoksa 0 (nötr) döner.
 */
import { db } from "@/lib/db";

type Checkpoint = { place: number; timeReal: number; checkpoint: number };

function son800Suresi(cps: Checkpoint[], raceLength: number): number | null {
  const hedef = raceLength - 800;
  const finish = cps[cps.length - 1];
  if (!finish) return null;
  const en = [...cps].sort((a, b) => Math.abs(a.checkpoint - hedef) - Math.abs(b.checkpoint - hedef))[0];
  return en ? finish.timeReal - en.timeReal : null;
}

const MAX_GECMIS_YARIS = 5; // atın son N yarışının ortalaması (aşırı eski veriye ağırlık vermesin)

type FarkKaydi = { horseName: string; date: number; fark: number };

// hiz-derecesi.actions.ts / zemin-toleransi.actions.ts ile AYNI desen: tüm Accurace
// arşivini (checkpoint'ler dahil, ~3800 yarış) her çağrıda yeniden işlemek (arac-model-
// veri-olustur.mts BİNLERCE satır için çağırır) çok yavaş olurdu — modül-seviyesi 6
// saatlik TTL'li önbellek, cutoff filtresi HER ÇAĞRIDA bellek-içi uygulanır.
const ONBELLEK_TTL_MS = 6 * 60 * 60 * 1000;
let onbellekCache: { veri: FarkKaydi[]; zaman: number } | null = null;

async function tumFarklariGetir(): Promise<FarkKaydi[]> {
  if (onbellekCache && Date.now() - onbellekCache.zaman < ONBELLEK_TTL_MS) return onbellekCache.veri;

  const accRaces = await db.accuraceRace.findMany({
    select: { date: true, length: true, splits: { select: { horseName: true, checkpoints: true } } },
  });

  const veri: FarkKaydi[] = [];
  for (const ar of accRaces) {
    if (!ar.length) continue;
    const perAt = ar.splits
      .map((s) => {
        const cps = (s.checkpoints as unknown as Checkpoint[]).filter((c) => c.checkpoint < ar.length!);
        if (cps.length < 3) return null;
        const s800 = son800Suresi(cps, ar.length!);
        return s800 == null ? null : { horseName: s.horseName, s800 };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);
    if (perAt.length < 3) continue; // az atlı yarışta "en iyi" referansı gürültülü

    const enIyi = Math.min(...perAt.map((p) => p.s800));
    for (const p of perAt) {
      veri.push({ horseName: p.horseName, date: ar.date.getTime(), fark: (p.s800 - enIyi) / 1000 });
    }
  }
  onbellekCache = { veri, zaman: Date.now() };
  return veri;
}

/**
 * Verilen atların, cutoffTarihi'nden ÖNCEKİ Accurace yarışlarından hesaplanan ortalama
 * "tempo taşıma gücü"nü döner (atAdi -> puan). YÜKSEK = tempoyu iyi taşıyor (fark az),
 * DÜŞÜK/NEGATİF = erken enerji harcayıp geride kalıyor. Veri yoksa (n=0) 0 (nötr) döner.
 */
export async function hesaplaTempoTasimaGucuMap(atIsimleri: string[], cutoffTarihi: Date): Promise<Map<string, number>> {
  const tumVeri = await tumFarklariGetir();
  const atSeti = new Set(atIsimleri);
  const cutoffMs = cutoffTarihi.getTime();

  const atGecmisi = new Map<string, FarkKaydi[]>();
  for (const v of tumVeri) {
    if (!atSeti.has(v.horseName) || v.date >= cutoffMs) continue;
    const arr = atGecmisi.get(v.horseName) ?? [];
    arr.push(v);
    atGecmisi.set(v.horseName, arr);
  }

  const sonuc = new Map<string, number>();
  for (const ad of atIsimleri) {
    const gecmis = atGecmisi.get(ad);
    if (!gecmis || gecmis.length === 0) {
      sonuc.set(ad, 0);
      continue;
    }
    const sonNTane = [...gecmis].sort((a, b) => b.date - a.date).slice(0, MAX_GECMIS_YARIS);
    const ortFark = sonNTane.reduce((s, e) => s + e.fark, 0) / sonNTane.length;
    sonuc.set(ad, -ortFark); // işaret çevrilir: yüksek = iyi (fark az)
  }
  return sonuc;
}
