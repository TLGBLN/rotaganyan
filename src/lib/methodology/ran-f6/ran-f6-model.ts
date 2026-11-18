// RAN F6 — SAF HESAPLAMA (kullanıcı kararı 2026-11-18): beş sinyal ailesinin (ACC_HIZ, J_SEVIYE, GALOP_KAPASITE, H2H_NET, SON_YARIS_SONUCU = Y_son + T_son) altı bileşeninden
// yarış-bazlı KALİBRE kazanma olasılığı. DONDURULMUŞ tanım ve katsayılar (ran-f6-katsayilar.ts, otomatik üretilmiş) kullanılır; burada eğitim/öğrenme YOKTUR.
//   SON6 YOKTUR (kullanıcı kararıyla çıkarıldı). AGF girmez (AGF yalnız ayrı referans/karşılaştırma katmanıdır). Mevcut banko/kupon mantığına dokunmaz.
// SAF: veritabanı / ağ / saat / rastgelelik YOK; yalnız girdi değerlerinden hesap.
//   Değer ölçeği (araştırma düzeneğiyle BİREBİR): x = değer / ölçek; yarışta ≥2 at değeri varsa eksikler yarış ortalamasıyla doldurulur, <2 ise bu sinyalin tüm x'i 0 (bilgi yok → nötr).
//   Skor = Σ β·x (koşullu logit); olasılık = softmax; kalibrasyon: p^τ normalize (τ dondurulmuş).
//   Tip bazlı ek kapatma YOK (kullanıcı kararı): sinyal veri varsa hesaplanır; veri yoksa NULL (nötr). İlk start sınıfı (Şartlı 1/27): atların %100'ü ilk kez koşan; yalnız J_SEVIYE + GALOP_KAPASITE, ayrı katsayılarla.
import { RAN_F6_BETA_ANA, RAN_F6_BETA_ILK_START, RAN_F6_KATSAYI_SURUMU, RAN_F6_OLCEK, RAN_F6_TAU } from "./ran-f6-katsayilar";

export type F6Sinyal = "acc" | "kap" | "S" | "h2h" | "sY" | "sT";
export const F6_SINYALLER: readonly F6Sinyal[] = ["acc", "kap", "S", "h2h", "sY", "sT"] as const;
export const F6_SINYAL_ADLARI: Record<F6Sinyal, string> = { acc: "ACC_HIZ", kap: "GALOP_KAPASITE", S: "J_SEVIYE", h2h: "H2H_NET", sY: "Y_SON", sT: "T_SON" };
export const F6_AILE: Record<F6Sinyal, string> = { acc: "ACC_HIZ", kap: "GALOP_KAPASITE", S: "J_SEVIYE", h2h: "H2H_NET", sY: "SON_YARIS_SONUCU", sT: "SON_YARIS_SONUCU" };
export type TurGrubu = "MAIDEN" | "SARTLI_345" | "SARTLI_219" | "SARTLI_127" | "HANDIKAP" | "KV" | "GRUP_SATIS" | "DIGER";
export type EtkiSeviyesi = "yüksek" | "orta" | "düşük" | "yetersiz kanıt";
export type TurAyari = { ad: string; kapali: readonly F6Sinyal[]; ilkStart: boolean; etki: EtkiSeviyesi; not: string };

/**
 * YARIŞ TİPİ AYARI (kullanıcı kararı 2026-11-18, düzeltme): TİP BAZLI EK KAPATMA YOK. Beş sinyal ailesi (altı bileşen) VERİ VARSA her yarış tipinde hesaplanır.
 * Bir sinyalin bir tipte istatistiksel katkısının KANITLANMAMIŞ olması onun zararlı olduğu anlamına GELMEZ; bu yüzden kapatılmaz (kanıt durumu yalnız bilgidir, KANIT tablosu).
 * Sinyali olmayan (ör. ilk kez koşan atın geçmiş yarışı yok) hesaplanamaz: değer NULL → o at için nötr (veri yoksa 0 puan sayılmaz, yarış ortalamasıyla doldurulur).
 * Tek özel durum: İLK START sınıfı (Şartlı 1/27): atların %100'ü ilk kez koşan; ACC_HIZ, H2H_NET, Y_SON, T_SON'un verisi YOKTUR → yalnız J_SEVIYE + GALOP_KAPASITE, segment-özel katsayıyla (kullanıcı kararı).
 * 'etki' = keşif dönemindeki F6 model kazancı (1/N log-loss'un kapatılan yüzdesi): ≥10 yüksek, 7–10 orta, <7 düşük. Bağımsız doğrulama DEĞİL; ileri-yönlü izleme gerekir.
 */
export const TUR_AYAR: Record<TurGrubu, TurAyari> = {
  MAIDEN: { ad: "Maiden", kapali: [], ilkStart: false, etki: "yüksek", not: "Altı bileşenin hepsi veri varsa hesaplanır. H2H_NET'in özgün katkısı keşifte pozitif gösterilemedi (kanıtlanmadı; zararlı demek değil). Keşifte F6 kazancı %11–13." },
  SARTLI_345: { ad: "Şartlı 3/4/5", kapali: [], ilkStart: false, etki: "yüksek", not: "Altı bileşenin hepsi hesaplanır (GALOP, H2H_NET, T_SON 'izlenir'). Keşifte kazanç %9–11." },
  SARTLI_219: { ad: "Şartlı 2/19", kapali: [], ilkStart: false, etki: "yetersiz kanıt", not: "Test yarışı <200: kanıt yetersiz; altı bileşen hesaplanır." },
  SARTLI_127: { ad: "Şartlı 1/27 (ilk start)", kapali: ["acc", "h2h", "sY", "sT"], ilkStart: true, etki: "orta", not: "Atların %100'ü ilk kez koşan: ACC_HIZ, H2H_NET, Y_SON, T_SON için geçmiş yarış verisi YOK (kullanılamaz — veri yok). Yalnız J_SEVIYE + GALOP_KAPASITE; segment-özel katsayı. Kazanç ortak β'da %3,2, segment-özel β'da %7,2." },
  HANDIKAP: { ad: "Handikap", kapali: [], ilkStart: false, etki: "orta", not: "Altı bileşenin hepsi hesaplanır. GALOP_KAPASITE'nin özgün katkısı galop kapsamlı dönemde pozitif gösterilemedi (kanıtlanmadı; zararlı olduğu anlamına GELMEZ); hafif kilo × iyi galop hipotezi doğrulanmadı ama çürütülmedi. Keşifte kazanç %7,6–8,8." },
  KV: { ad: "KV", kapali: [], ilkStart: false, etki: "orta", not: "Altı bileşenin hepsi hesaplanır. T_SON özgün katkısı keşifte pozitif gösterilemedi (kanıtlanmadı). Keşifte kazanç %7,8–8,5." },
  GRUP_SATIS: { ad: "Grup + Satış", kapali: [], ilkStart: false, etki: "yüksek", not: "Altı bileşenin hepsi hesaplanır. T_SON özgün katkısı keşifte pozitif gösterilemedi (kanıtlanmadı). Örneklem küçük (~250 yarış). Keşifte kazanç %9,7–11,8." },
  DIGER: { ad: "Diğer", kapali: [], ilkStart: false, etki: "yetersiz kanıt", not: "Tanınmayan/seyrek tip: altı bileşen hesaplanır. Kanıt yok." },
};

export type KanitDurumu = "etkili" | "izlenir" | "kanıtlanmadı" | "yetersiz örnek" | "veri yok";
/** Keşif dönemindeki özgün katkı kanıtı (SINYAL_SETI_RAPORU; GALOP için galop kapsamlı dönem). YALNIZ BİLGİ: hiçbir sinyali KAPATMAZ. 'kanıtlanmadı' ≠ zararlı. */
export const KANIT: Record<TurGrubu, Record<F6Sinyal, KanitDurumu>> = {
  MAIDEN: { acc: "etkili", kap: "etkili", S: "etkili", h2h: "kanıtlanmadı", sY: "etkili", sT: "etkili" },
  SARTLI_345: { acc: "etkili", kap: "izlenir", S: "etkili", h2h: "izlenir", sY: "etkili", sT: "izlenir" },
  SARTLI_219: { acc: "yetersiz örnek", kap: "yetersiz örnek", S: "etkili", h2h: "yetersiz örnek", sY: "yetersiz örnek", sT: "yetersiz örnek" },
  SARTLI_127: { acc: "veri yok", kap: "etkili", S: "etkili", h2h: "veri yok", sY: "veri yok", sT: "veri yok" },
  HANDIKAP: { acc: "etkili", kap: "kanıtlanmadı", S: "etkili", h2h: "etkili", sY: "etkili", sT: "etkili" },
  KV: { acc: "izlenir", kap: "izlenir", S: "etkili", h2h: "etkili", sY: "etkili", sT: "kanıtlanmadı" },
  GRUP_SATIS: { acc: "etkili", kap: "izlenir", S: "etkili", h2h: "etkili", sY: "izlenir", sT: "kanıtlanmadı" },
  DIGER: { acc: "yetersiz örnek", kap: "yetersiz örnek", S: "yetersiz örnek", h2h: "yetersiz örnek", sY: "yetersiz örnek", sT: "yetersiz örnek" },
};

/** TJK sınıf adından tip grubu (araştırma düzeneğiyle BİREBİR: ilk '/' öncesi, büyük harf, sıralı kontrol; Şartlı numarası tam ad üzerinden). */
export function turGrubu(classType: string): TurGrubu {
  const u = String(classType ?? "").split("/")[0]!.trim().toUpperCase();
  if (u.includes("MAIDEN")) return "MAIDEN";
  if (u.includes("ŞARTLI")) { const m = String(classType).match(/(?:ŞARTLI|SARTLI)\s*(\d+)/i); const n = m ? parseInt(m[1]!, 10) : null; return n === 1 || n === 27 ? "SARTLI_127" : n === 3 || n === 4 || n === 5 ? "SARTLI_345" : n === 2 || n === 19 ? "SARTLI_219" : "DIGER"; }
  if (u.includes("HANDIKAP")) return "HANDIKAP";
  if (u.startsWith("KV")) return "KV";
  if (/^G \d/.test(u) || u.includes("SATIŞ")) return "GRUP_SATIS";
  return "DIGER";
}

export type F6AtGirdisi = { deger: Partial<Record<F6Sinyal, number | null | undefined>> };
export type F6AtSonucu = { index: number; olasilik: number; sira: number; skor: number; katki: Partial<Record<F6Sinyal, number>>; ham: Partial<Record<F6Sinyal, number | null>>; eksik: F6Sinyal[] };
export type F6YarisSonucu = { surum: string; tur: TurGrubu; model: "ANA" | "ILK_START"; tau: number; kullanilan: F6Sinyal[]; kapali: F6Sinyal[]; atlar: F6AtSonucu[] };

/** x = değer/ölçek; ≥2 değerli at varsa eksikler yarış ortalamasıyla doldurulur; <2 ise tüm x = 0 (araştırma 'doldur' kuralı). */
function doldur(x: (number | null)[]): number[] { const a = x.filter((v): v is number => v != null && Number.isFinite(v)); if (a.length < 2) return x.map(() => 0); const mu = a.reduce((s, v) => s + v, 0) / a.length; return x.map((v) => (v == null || !Number.isFinite(v) ? mu : v)); }

export function hesaplaF6(atlar: readonly F6AtGirdisi[], tur: TurGrubu): F6YarisSonucu {
  const ayar = TUR_AYAR[tur]; const ilk = ayar.ilkStart; const kolonlar: readonly F6Sinyal[] = ilk ? (["S", "kap"] as const) : F6_SINYALLER.filter((c) => !ayar.kapali.includes(c)); const beta: Record<string, number> = ilk ? RAN_F6_BETA_ILK_START : RAN_F6_BETA_ANA;
  const n = atlar.length; const skor = new Array<number>(n).fill(0); const katki: Partial<Record<F6Sinyal, number>>[] = atlar.map(() => ({})); const eksik: F6Sinyal[][] = atlar.map(() => []); const ham: Partial<Record<F6Sinyal, number | null>>[] = atlar.map(() => ({}));
  for (const c of kolonlar) { const b = beta[c]; if (b == null) continue; const sc = RAN_F6_OLCEK[c] ?? 1; const raw = atlar.map((a) => { const v = a.deger[c]; return v == null || !Number.isFinite(v) ? null : v; }); raw.forEach((v, i) => { ham[i]![c] = v; if (v == null) eksik[i]!.push(c); });
    const x = doldur(raw.map((v) => (v == null ? null : v / sc))); const ort = x.reduce((s, v) => s + v, 0) / (n || 1); x.forEach((v, i) => { skor[i]! += b * v; katki[i]![c] = b * (v - ort); }); }
  const mx = Math.max(...skor); const e = skor.map((s) => Math.exp(s - mx)); const z = e.reduce((s, v) => s + v, 0); let p = e.map((v) => v / z);
  const tau = RAN_F6_TAU; const pt = p.map((v) => Math.pow(Math.max(v, 1e-12), tau)); const zt = pt.reduce((s, v) => s + v, 0); p = pt.map((v) => v / zt);
  const sira = p.map((v, i) => [v, i] as [number, number]).sort((a, b) => b[0] - a[0] || a[1] - b[1]); const rank = new Array<number>(n); sira.forEach(([, i], r) => { rank[i] = r + 1; });
  return { surum: RAN_F6_KATSAYI_SURUMU, tur, model: ilk ? "ILK_START" : "ANA", tau, kullanilan: [...kolonlar], kapali: ilk ? F6_SINYALLER.filter((c) => !kolonlar.includes(c)) : [...ayar.kapali], atlar: atlar.map((_, i) => ({ index: i, olasilik: p[i]!, sira: rank[i]!, skor: skor[i]!, katki: katki[i]!, ham: ham[i]!, eksik: eksik[i]! })) };
}
