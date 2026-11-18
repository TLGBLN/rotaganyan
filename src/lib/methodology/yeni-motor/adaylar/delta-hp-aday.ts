// YENİ MOTOR — ADAY HESAP: DELTA_HP (kullanıcı kararı 2026-11-18; Handikap araştırmasından çıkan aday). AKTİF SİNYAL DEĞİLDİR: SINYAL_KAYDI'na EKLENMEDİ.
// Yalnız HANDİKAP yarışları için değerlendirilir; tüm koşu tiplerine otomatik uygulanmaz.
//   ΔHP = HP_bugün − HP_önceki_yarış                       (kullanıcı tanımı)
// SAF: veritabanı / ağ / saat / rastgelelik YOK. İki girdi de hedef yarıştan ÖNCE bilinmelidir:
//   HP_bugün     : hedef yarışın programında ilan edilen puan (çağıran verir; yarış sonucundan sonra güncellenmiş bir değer OLMAMALI — araç tarafında denetlenir),
//   HP_önceki    : atın hedef yarış gününden KESİNLİKLE önceki (tarih < t) EN SON yarışındaki puan.
// "Önceki yarış" = tarihe göre hedeften önceki en son kayıt; o kaydın HP'si yoksa değer NULL'dır (daha eski bir yarışa SESSİZCE geri gidilmez; sıfır DEĞİL).
// Duyarlılık (ayrı fonksiyon): deltaHpSonBilinen = en son HP'si BİLİNEN önceki yarışa göre fark (aradaki gün sayısıyla birlikte).
// Pozitif/negatif ΔHP otomatik avantaj/dezavantaj DEĞİLDİR; yön ve eşik kararı verilmedi (sınıflar yalnız raporlama içindir).
export const DELTA_HP_GUN_MS = 86400000;
/** tarih: yarış günü (ms, UTC gece yarısı); hp: o yarıştaki handikap puanı (yoksa null). */
export type HpGecmis = { tarih: number; hp: number | null };
export type DeltaHp = { delta: number | null; hpBugun: number | null; hpOnceki: number | null; gunAra: number | null; nGecmis: number };

const gecerli = (x: number | null | undefined): x is number => x != null && Number.isFinite(x) && x > 0;
/** Hedef gün t'den kesin önceki kayıtlar, eskiden yeniye. */
const oncekiler = (gecmis: HpGecmis[], t: number) => gecmis.filter((x) => x.tarih < t).sort((a, b) => a.tarih - b.tarih);

/** Kullanıcı tanımı: HP_bugün − (hemen önceki yarışın HP'si). Önceki yarışın HP'si yoksa NULL. */
export function deltaHp(hpBugun: number | null, gecmis: HpGecmis[], t: number): DeltaHp {
  const o = oncekiler(gecmis, t); const son = o.length ? o[o.length - 1]! : null; const hb = gecerli(hpBugun) ? hpBugun : null; const ho = son && gecerli(son.hp) ? son.hp : null;
  return { delta: hb != null && ho != null ? hb - ho : null, hpBugun: hb, hpOnceki: ho, gunAra: son ? Math.round((t - son.tarih) / DELTA_HP_GUN_MS) : null, nGecmis: o.length };
}
/** Duyarlılık: en son HP'si BİLİNEN önceki yarışa göre fark (gunAra = o yarışla bugün arasındaki gün). */
export function deltaHpSonBilinen(hpBugun: number | null, gecmis: HpGecmis[], t: number): DeltaHp {
  const o = oncekiler(gecmis, t).filter((x) => gecerli(x.hp)); const son = o.length ? o[o.length - 1]! : null; const hb = gecerli(hpBugun) ? hpBugun : null;
  return { delta: hb != null && son ? hb - son.hp! : null, hpBugun: hb, hpOnceki: son ? son.hp : null, gunAra: son ? Math.round((t - son.tarih) / DELTA_HP_GUN_MS) : null, nGecmis: o.length };
}
/** Yükseliş ve düşüşü ayrı eğimle incelemek için (kullanıcı talimatı); yeni formül DEĞİL. */
export const deltaHpYonlu = (d: number | null) => (d == null ? { pos: null, neg: null } : { pos: Math.max(d, 0), neg: Math.min(d, 0) });
/** Raporlama sınıfları (önceden sabit; sonuca göre ayarlanmadı): 0: ≤−3, 1: −2…−1, 2: 0 (değişmedi), 3: +1…+2, 4: ≥+3 puan. */
export const deltaHpSinif = (d: number | null) => (d == null ? null : d <= -3 ? 0 : d < 0 ? 1 : d === 0 ? 2 : d < 3 ? 3 : 4);
/** Sızıntı dedektörü: tarih ≥ t olan kayıtların HP'si bozulur, aynı güne/geleceğe sahte kayıtlar eklenir. */
export function deltaHpGelecegiBoz(gecmis: HpGecmis[], t: number, tohum = 1): HpGecmis[] {
  let s = tohum; const r = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const yeni = gecmis.map((x) => (x.tarih < t ? x : { tarih: x.tarih, hp: 30 + Math.floor(r() * 60) }));
  yeni.push({ tarih: t, hp: 99 }, { tarih: t + DELTA_HP_GUN_MS, hp: 12 }, { tarih: t + 9 * DELTA_HP_GUN_MS, hp: 77 }); return yeni;
}
