// RAN F6 — SAF HESAPLAMA (kullanıcı kararı 2026-11-18): beş sinyal ailesinin (ACC_HIZ, J_SEVIYE, GALOP_KAPASITE, H2H_NET, SON_YARIS_SONUCU = Y_son + T_son) altı bileşeninden
// yarış-bazlı KALİBRE kazanma olasılığı. DONDURULMUŞ tanım ve katsayılar (ran-f6-katsayilar.ts, otomatik üretilmiş) kullanılır; burada eğitim/öğrenme YOKTUR.
//   SON6 YOKTUR (kullanıcı kararıyla çıkarıldı). AGF girmez (AGF yalnız ayrı referans/karşılaştırma katmanıdır). Mevcut banko/kupon mantığına dokunmaz.
// SAF: veritabanı / ağ / saat / rastgelelik YOK; yalnız girdi değerlerinden hesap.
//   Değer ölçeği (araştırma düzeneğiyle BİREBİR): x = değer / ölçek; yarışta ≥2 at değeri varsa eksikler yarış ortalamasıyla doldurulur, <2 ise bu sinyalin tüm x'i 0 (bilgi yok → nötr).
//   Skor = Σ β·x (koşullu logit); olasılık = softmax; kalibrasyon: p^τ normalize (τ dondurulmuş).
//   Yarış tipine göre kullanım maskesi (TUR_AYAR): kapalı sinyaller NULL sayılır (nötr; araştırmadaki maskeli eğitimle aynı). İlk start sınıfı (Şartlı 1/27): yalnız J_SEVIYE + GALOP_KAPASITE, ayrı katsayılarla.
import { RAN_F6_BETA_ANA, RAN_F6_BETA_ILK_START, RAN_F6_KATSAYI_SURUMU, RAN_F6_OLCEK, RAN_F6_TAU } from "./ran-f6-katsayilar";

export type F6Sinyal = "acc" | "kap" | "S" | "h2h" | "sY" | "sT";
export const F6_SINYALLER: readonly F6Sinyal[] = ["acc", "kap", "S", "h2h", "sY", "sT"] as const;
export const F6_SINYAL_ADLARI: Record<F6Sinyal, string> = { acc: "ACC_HIZ", kap: "GALOP_KAPASITE", S: "J_SEVIYE", h2h: "H2H_NET", sY: "Y_SON", sT: "T_SON" };
export const F6_AILE: Record<F6Sinyal, string> = { acc: "ACC_HIZ", kap: "GALOP_KAPASITE", S: "J_SEVIYE", h2h: "H2H_NET", sY: "SON_YARIS_SONUCU", sT: "SON_YARIS_SONUCU" };
export type TurGrubu = "MAIDEN" | "SARTLI_345" | "SARTLI_219" | "SARTLI_127" | "HANDIKAP" | "KV" | "GRUP_SATIS" | "DIGER";
export type EtkiSeviyesi = "yüksek" | "orta" | "düşük" | "yetersiz kanıt";
export type TurAyari = { ad: string; kapali: readonly F6Sinyal[]; ilkStart: boolean; etki: EtkiSeviyesi; not: string };

/**
 * YARIŞ TİPİ KULLANIM AYARI (önceden bildirilen kural, SINYAL_SETI_RAPORU özgün katkısından; test sonucuna göre değiştirilmedi): sinyal bir tipte AKTİF = özgün katkı ΔLL% noktası > 0
 * (GALOP için galop kapsamlı örneklem); ✓ → etkili, ○ pozitif → izlenir; ≤ 0 → KAPALI; n<200 test yarışlı tipte (Şartlı 2/19) maske uygulanmaz; Şartlı 1/27 kullanıcı kararıyla J_SEVIYE+GALOP.
 * 'etki' = keşif dönemindeki F6 model kazancı (1/N log-loss'un kapatılan yüzdesi): ≥10 yüksek, 7–10 orta, <7 düşük. Bağımsız doğrulama DEĞİL; ileri-yönlü izleme gerekir.
 */
export const TUR_AYAR: Record<TurGrubu, TurAyari> = {
  MAIDEN: { ad: "Maiden", kapali: ["h2h"], ilkStart: false, etki: "yüksek", not: "H2H_NET özgün katkısı ≤ 0 (−0,38%): kapalı. Keşifte F6 kazancı %11–13." },
  SARTLI_345: { ad: "Şartlı 3/4/5", kapali: [], ilkStart: false, etki: "yüksek", not: "Altı bileşenin hepsi aktif (GALOP, H2H_NET, T_SON 'izlenir': özgün katkı pozitif ama ○). Keşifte kazanç %9–11." },
  SARTLI_219: { ad: "Şartlı 2/19", kapali: [], ilkStart: false, etki: "yetersiz kanıt", not: "Test yarışı <200: maske uygulanmadı, genel altı bileşen. Kanıt yetersiz." },
  SARTLI_127: { ad: "Şartlı 1/27 (ilk start)", kapali: ["acc", "h2h", "sY", "sT"], ilkStart: true, etki: "orta", not: "Atların %100'ü ilk kez koşan: ACC_HIZ, H2H_NET, Y_SON, T_SON veri YOK (kullanılamaz). Yalnız J_SEVIYE + GALOP_KAPASITE; segment-özel katsayı. Kazanç ortak β'da %3,2, segment-özel β'da %7,2." },
  HANDIKAP: { ad: "Handikap", kapali: ["kap"], ilkStart: false, etki: "orta", not: "GALOP_KAPASITE özgün katkısı ≤ 0 (−0,10% galop kapsamlı dönem): kapalı (hafif kilo × iyi galop hipotezi doğrulanmadı). Keşifte kazanç %7,6–8,8." },
  KV: { ad: "KV", kapali: ["sT"], ilkStart: false, etki: "orta", not: "T_SON özgün katkısı ≤ 0: kapalı. ACC_HIZ ve GALOP 'izlenir' (○, pozitif). Keşifte kazanç %7,8–8,5." },
  GRUP_SATIS: { ad: "Grup + Satış", kapali: ["sT"], ilkStart: false, etki: "yüksek", not: "T_SON kapalı (≤ 0); Y_SON ve GALOP 'izlenir'. Örneklem küçük (~250 yarış). Keşifte kazanç %9,7–11,8." },
  DIGER: { ad: "Diğer", kapali: [], ilkStart: false, etki: "yetersiz kanıt", not: "Tanınmayan/seyrek tip: maske yok, genel altı bileşen. Kanıt yok." },
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
