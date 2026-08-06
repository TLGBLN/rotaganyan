import type { Faz1Sonuc } from "@/lib/methodology/veri-toplama";
import type { Faz2Atlar, Faz3Pick } from "@/lib/methodology/claude-analiz-helpers";
import type { PedigreeRating } from "@prisma/client";

export type FinalPick = {
  rank: number; no: number; name: string; score: number;
  pedigreeRating: PedigreeRating; isTarget: boolean; details: string[]; note: string;
};

/**
 * v6.3 — kullanıcı talimatı: "güçlü ve gerçekten çalışan bir kontrol mekanizması
 * kurulmalı ama yayın öncesi değil son sıralama oluşturulmadan önce... sonrasında
 * düzeltilmek üzere bana not olarak ver sadece. analiz gerçekleşsin. ama gerçek bir
 * kontrol olsun, gerçek bir eksikliği göstersin." Yani: analizi ASLA durdurmaz/
 * engellemez, yalnız Faz3'ün KENDİ kurallarını (§XVI AGF asimetri, §X/§XI Son800+
 * galop, §XX.27 HP-tek-başına, §XIX.0a Hedef, §XIX.0b banko/confidence tutarlılığı)
 * gerçekten uygulayıp uygulamadığını HAM VERİYE bakarak (F hariç, o metin taramasıdır)
 * kontrol eder — sahte pozitif üretmemesi için yalnız somut, ölçülebilir eşiklerle çalışır.
 *
 * v6.66 — 2026-08-06: bu dosya kazayla `oto-analiz-faz3/route.ts` ile birlikte silinmiş,
 * git HEAD'den (kayıp değilmiş, proje aslında git ile takip ediliyormuş) kurtarılmıştı.
 * Orijinal route dosyası (Faz1Runner'ın artık kaldırılmış eski alanlarına bağımlı olduğu
 * için) güncel veri modeliyle DERLENMİYOR ve zaten V2'ye geçişle birlikte ölü koddu — bu
 * yüzden yalnız bu saf fonksiyon (kontrolNotlariUret, birebir orijinal mantık) buraya
 * taşındı, route dosyasının kendisi tekrar kaldırıldı (bkz. git geçmişi, gerektiğinde
 * kurtarılabilir).
 */
export function kontrolNotlariUret(
  faz1: Faz1Sonuc, faz2: Faz2Atlar, tumSira: Faz3Pick[],
  bankoInfo: { isBanko: boolean; bankoNote: string }
): string[] {
  const notlar: string[] = [];
  const runnerByNo = new Map(faz1.runners.map((r) => [r.no, r]));
  const rankByNo = new Map(tumSira.map((p) => [p.no, p.rank]));
  const sahaBuyuklugu = faz1.runners.length;

  // A) ★ Hedef kuralı (§XIX.0a): ilk 3'ün hemen altına getirilmesi gerekiyordu.
  for (const p of tumSira) {
    if (!p.isTarget) continue;
    if (p.rank > 5) {
      notlar.push(`★ Hedef işaretlenen #${p.no} ${p.name}, ilk 3'ün hemen altına getirilmemiş (şu an ${p.rank}. sıra) — §XIX.0a kuralı tam uygulanmamış olabilir.`);
    }
  }

  // B) AGF favorisi (%25+) gerekçesiz/detaysız mı kalmış.
  const agfSirali = [...faz1.runners].filter((r) => r.agf != null).sort((a, b) => b.agf! - a.agf!);
  const agfFavori = agfSirali[0];
  if (agfFavori && agfFavori.agf! >= 25) {
    const pick = tumSira.find((p) => p.no === agfFavori.no);
    if (!pick || pick.details.length === 0) {
      notlar.push(`AGF favorisi #${agfFavori.no} ${agfFavori.ad} (%${agfFavori.agf}) için hiç detay/gerekçe üretilmemiş — gerçekten değerlendirildiğinden emin olun.`);
    }
  }

  // C) Son800 (n≥3, medyan≤-0.5) + keskin galop zinciri birlikte varken alt yarıda mı.
  for (const r of faz1.runners) {
    const guclu800 = r.son800BenzerKosuN >= 3 && r.son800Medyan != null && r.son800Medyan <= -0.5;
    if (!guclu800 || !r.keskinGalopZinciri) continue;
    const rank = rankByNo.get(r.no);
    if (rank != null && rank > Math.ceil(sahaBuyuklugu / 2)) {
      notlar.push(`#${r.no} ${r.ad}: güçlü Son800 (n=${r.son800BenzerKosuN}, medyan ${r.son800Medyan}) + keskin galop zinciri birlikte var ama ${rank}. sırada (saha ${sahaBuyuklugu}) — §X/§XI/§XX.28 destekleyici kombinasyonu göz ardı edilmiş olabilir.`);
    }
  }

  // D) Faz2'de teknik ilk 3'teyken Faz3'te belirgin düşürülmüş + AGF düşük — asimetri ihlali şüphesi.
  const teknikSiraByNo = new Map(faz2.atlar.map((a) => [a.no, a.teknikSira]));
  for (const p of tumSira) {
    const teknikSira = teknikSiraByNo.get(p.no);
    const r = runnerByNo.get(p.no);
    if (teknikSira != null && teknikSira <= 3 && p.rank > teknikSira + 2 && r && (r.agf ?? 100) < 10) {
      notlar.push(`#${p.no} ${p.name}: Faz2'de teknik ${teknikSira}. sıradaydı, Faz3'te ${p.rank}. sıraya düşürülmüş; AGF'si düşük (%${r.agf ?? "?"}) — düşük AGF'nin geriye çekme gerekçesi OLMADIĞINDAN emin olun (§XVI asimetrik kural, §XX.26).`);
    }
  }

  // E) En yüksek ham HP'ye sahip at 1. sıradaysa ve neredeyse hiç başka gerekçesi yoksa.
  const enYuksekHp = [...faz1.runners].filter((r) => r.hpBugun != null).sort((a, b) => b.hpBugun! - a.hpBugun!)[0];
  if (enYuksekHp) {
    const rank1 = tumSira.find((p) => p.rank === 1);
    if (rank1 && rank1.no === enYuksekHp.no && rank1.details.length <= 1) {
      notlar.push(`#${rank1.no} ${rank1.name} en yüksek ham HP'ye (${enYuksekHp.hpBugun}) sahip olduğu için 1. sıraya konmuş görünüyor (yalnız ${rank1.details.length} detay var) — form/tempo uyumunun da gerçekten değerlendirildiğinden emin olun (§XX.27).`);
    }
  }

  // F) Banko verildi ama bankoNote kendi kendiyle çelişen bir çekince yazıyor mu (§XIX.0b).
  // confidence=YUKSEK şartı bunu artık kaynağında engelliyor, ama Claude yine de YUKSEK
  // seçip metinde çekince yazabilir — bu son bir savunma katmanı, metin taraması olduğu
  // için diğer kontroller kadar kesin değil, admin gözden geçirsin diye not düşülür.
  if (bankoInfo.isBanko) {
    const cekinceKaliplari = /ancak|fakat|ama\b|risk|sürpriz|belirsiz|netliği azalt|şüphe/i;
    if (cekinceKaliplari.test(bankoInfo.bankoNote)) {
      notlar.push(`Banko verildi ama bankoNote kendi içinde bir çekince barındırıyor gibi görünüyor: "${bankoInfo.bankoNote}" — gerçekten YÜKSEK güvenli mi, elle kontrol edin.`);
    }
  }

  return notlar;
}
