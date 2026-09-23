import {
  faz2V5Sirala, type Faz1RunnerV5Sirali, type Faz1SonucV5,
  agirlikSetleriSec, harmanliSkorla, toFeatureVector, bKatmaniUygula, softmax, liderEsigiHesapla,
} from "./v5-engine";
import { kategoriTespit } from "./v2-engine";
import { hesaplaGecmisPistleriMap } from "@/server/actions/yuzey-degisikligi.actions";
import { ilkKezBuPisteMi } from "@/lib/yuzey-degisikligi";
import { surfaceToPist } from "@/lib/sire-stat-match";
import { zeminToleransiOlcekli, PIST_OLCEK_GRID } from "./pist-dayanikliligi";

// 2026-08-29 — V6 Aşama 3 (bkz. plan): champion/challenger gölge-testi altyapısının
// kayıt defteri. Her girdi, AYNI gatherFaz1V5 çıktısını (faz1) girdi alıp kendi
// sıralı/olasılıklı çıktısını üreten bir fonksiyon — canlı `olasilik`/sıralamayı HİÇ
// etkilemez, yalnız ChallengerRun'a kaydedilip gelecekte (n>=250-300 sonuçlanmış
// koşu birikince) arac-challenger-degerlendir.mjs ile B=500 bootstrap FARK testine
// tabi tutulur. Yeni bir aday eklemek için buraya yeni bir { key, label, scoreFn }
// eklemek yeterli — cron/servis/araç kodunun HİÇBİRİNE dokunmaya gerek yok.
//
// scoreFn ASYNC — bazı adaylar (örn. yüzey-değişikliği, TjkDereceKaydi arşivine gidiyor)
// kendi veri kaynağına ihtiyaç duyabilir, tıpkı gatherFaz1V5'in kendisi gibi.
export type ChallengerScoreFn = (faz1: Faz1SonucV5) => Promise<Faz1RunnerV5Sirali[]>;

export type ChallengerDef = {
  key: string;
  label: string;
  scoreFn: ChallengerScoreFn;
};

// 2026-08-30 — kullanıcı talebi: "at ilk defa bir pistte çıkacaksa (hep çim koşmuş,
// bu sefer kum gibi), bütün kategorilerde kullanılsın" — TjkDereceKaydi arşivinden
// (zeminToleransi ile AYNI kaynak) atın bugüne kadar HİÇ koşmadığı bir pist tipinde
// koşacağı durumu yakalar. HENÜZ HİÇ TEST EDİLMEDİ — bu yüzden A ya da B katmanına
// DEĞİL, yalnız gölge-teste (C katmanı) ekleniyor. Katsayı (-0.15, log-skor uzayında,
// olasılığı ~%14 azaltır) KANITLANMAMIŞ bir başlangıç varsayımı — "bilinmeyen yüzey
// riskli olabilir" hipotezini gölge-veride test edilebilir kılmak için seçildi, gerçek
// yönü/büyüklüğü yalnız arac-challenger-degerlendir.mjs'in B=500 sonucuyla belirlenecek.
const YUZEY_DEGISIKLIGI_KATSAYI = -0.15;

async function yuzeyDegisikligiScoreFn(faz1: Faz1SonucV5): Promise<Faz1RunnerV5Sirali[]> {
  const baseline = faz2V5Sirala(faz1);
  const bugunkuPist = surfaceToPist(faz1.race.surface);
  const gecmisPistlerByAd = await hesaplaGecmisPistleriMap(faz1.runners.map((r) => r.ad), new Date());

  const carpanlar = baseline.map((r) => {
    const gecmisPistler = gecmisPistlerByAd.get(r.ad) ?? new Set<string>();
    return ilkKezBuPisteMi(gecmisPistler, bugunkuPist) ? Math.exp(YUZEY_DEGISIKLIGI_KATSAYI) : 1;
  });
  const agirlikliToplam = baseline.reduce((s, r, i) => s + r.olasilik * carpanlar[i], 0);
  return baseline.map((r, i) => ({ ...r, olasilik: (r.olasilik * carpanlar[i]) / agirlikliToplam }));
}

// 2026-08-30 — kullanıcı talebi: "o pist, zemin koşul ve mesafede yarış geçmişi olan
// daha tecrübeli görülmeli olmayanlara göre. o pist, zemin koşul var ama mesafede ilk
// defa koşacaksa mevcut mesafelere göre analiz yapılacak" — bkz. plan (Zemin+Mesafe
// Deneyim Önceliklendirmesi). gatherFaz1V5 zaten her runner için zeminMesafeDeneyim (ham
// popülasyona-göreli pace %, zeminToleransi ile AYNI ölçek) hesaplıyor (bkz.
// zemin-mesafe-deneyimi.actions.ts) — bu challenger EK bir veri kaynağına gitmeden,
// doğrudan faz2V5Sirala çıktısındaki bu alanı skor-uzayında test eder. HENÜZ HİÇ TEST
// EDİLMEDİ — yuzeyDegisikligiScoreFn ile AYNI disiplin: katsayı (0.02, %1 göreli pace
// farkı başına log-skor uzayında) KANITLANMAMIŞ bir başlangıç varsayımı, gerçek yönü/
// büyüklüğü yalnız arac-challenger-degerlendir.mjs'in B=500 sonucuyla belirlenecek.
const ZEMIN_MESAFE_DENEYIM_KATSAYI = 0.02;

async function zeminMesafeDeneyimiScoreFn(faz1: Faz1SonucV5): Promise<Faz1RunnerV5Sirali[]> {
  const baseline = faz2V5Sirala(faz1);
  const carpanlar = baseline.map((r) => Math.exp(ZEMIN_MESAFE_DENEYIM_KATSAYI * r.zeminMesafeDeneyim));
  const agirlikliToplam = baseline.reduce((s, r, i) => s + r.olasilik * carpanlar[i], 0);
  return baseline.map((r, i) => ({ ...r, olasilik: (r.olasilik * carpanlar[i]) / agirlikliToplam }));
}

// 2026-09-23 — V5.46-C1 / LOW-HIZ-OFF: V5.46 LIVE Audit Protocol'ün (FAZ A-I) TEK gerçek
// production-değişikliği adayı. FAZ I (R2 refit-aware ablation) hizDerecesi'nin Düşük-Şart
// segmentinde REMOVE_CANDIDATE çıktığını buldu — race-level CI95=[+0.001,+0.053] TAMAMEN
// pozitif (β yeniden fit edilse bile bu segmentte gerçekten zararlı), signStability %99.3
// (bkz. proje hafızası: project_v546_live_audit_protocol.md). Diğer segmentte (ve tüm diğer
// 14 sinyalde) FAZ I sonucu ya KEEP_CONFIRMED (antrenorOrani/agfPayi2 — DOKUNULMUYOR) ya da
// INCONCLUSIVE (h2hNetSkor/idmJokey/yakinsama2Plus/Sire/hizDerecesi-Diğer — DOKUNULMUYOR)
// çıktı. Kullanıcı kararı: bunu HEMEN production'a almak yerine önce SHADOW'da forward
// doğrulama (checkpoint: 20 yön-bakışı/50 ilk karar/100+ anlamlı/150-200 güçlü karar,
// Düşük-Şart yarış sayısı bazında).
//
// Mekanizma: FAZ H/I'in TEST ETTİĞİ TAM AYNI ablation — skorlarHam'dan hizDerecesi'nin
// A-katmanı katkısı (katkilar[HIZ_DERECESI_IDX]) çıkarılır, B-katmanı (Sire/ZeminMesafe) ve
// kalibrasyon (softmax+liderEsigi) AYNEN yeniden uygulanır — "olasılığı sonradan yeniden
// ağırlıklandırma" (yuzeyDegisikligi/zeminMesafeDeneyimi'nin kullandığı exp(Δ) çarpanı) DEĞİL,
// üretim skorlama zincirinin birebir yeniden kurulması; FAZ I'in ölçtüğü mekanizmayla TAM
// TUTARLI kalması için bilerek bu şekilde yazıldı. Yalnız Düşük-Şart'ta (kategori 1a/1b)
// farklılaşır — Diğer/Handikap'ta baseline'la (champion) BİREBİR AYNI döner.
const HIZ_DERECESI_IDX = 6; // toFeatureVector sırası (v5-engine.ts:910-925)

async function v546C1LowHizOffScoreFn(faz1: Faz1SonucV5): Promise<Faz1RunnerV5Sirali[]> {
  const baseline = faz2V5Sirala(faz1);
  const kategori = kategoriTespit(faz1.race.classType);
  if (kategori !== "1a" && kategori !== "1b") return baseline; // yalnız Düşük-Şart'ta farklılaşır

  const setler = agirlikSetleriSec(faz1.race.classType);
  const harmanlar = faz1.runners.map((r) => harmanliSkorla(toFeatureVector(r), setler));
  const skorlarHam = harmanlar.map((h) => h.skor - h.katkilar[HIZ_DERECESI_IDX]);
  const { skorlar } = bKatmaniUygula(skorlarHam, faz1.runners, faz1.race.classType);
  const probs = softmax(skorlar, liderEsigiHesapla(faz1.race.classType));

  const olasilikByNo = new Map(faz1.runners.map((r, i) => [r.no, probs[i]]));
  const yenidenSirali = [...baseline].sort((a, b) => {
    const pa = olasilikByNo.get(a.no)!, pb = olasilikByNo.get(b.no)!;
    return pb !== pa ? pb - pa : a.no - b.no;
  });
  return yenidenSirali.map((r, i) => ({ ...r, olasilik: olasilikByNo.get(r.no)!, teknikSira: i + 1 }));
}

export const CHALLENGER_REGISTRY: ChallengerDef[] = [
  {
    key: "v546-c1-low-hiz-off",
    label: "V5.46-C1 / LOW-HIZ-OFF (Düşük-Şart'ta hizDerecesi kaldırılmış — FAZ I production-değişikliği adayı, SHADOW)",
    scoreFn: v546C1LowHizOffScoreFn,
  },
  {
    // 2026-08-29 — gerçek bir aday DEĞİL: champion'ın birebir kopyası (A/A sağlık
    // testi). Amaç, gelecekte gerçek bir aday eklendiğinde güvenilecek olan bu
    // ÖLÇÜM HATTININ KENDİSİNİN (eşleştirme, bootstrap, metrik hesaplama) doğru
    // çalıştığını kanıtlamak — iki özdeş model karşılaştırıldığında B=500 farkının
    // top1/top3/logloss'un ÜÇÜNDE de sıfırı içermesi beklenir. İçermiyorsa altyapıda
    // bir hata var demektir, gerçek bir aday güvenilir şekilde test edilemez.
    key: "v6-aa-sanity",
    label: "A/A Sağlık Testi (champion ile birebir aynı, gerçek aday değil)",
    scoreFn: async (faz1) => faz2V5Sirala(faz1),
  },
  {
    key: "v6-yuzey-degisikligi",
    label: "Yüzey Değişikliği (ilk kez bu pist tipinde koşuyor — deneysel, kanıtlanmamış)",
    scoreFn: yuzeyDegisikligiScoreFn,
  },
  {
    key: "v6-zemin-mesafe-deneyimi",
    label: "Zemin+Mesafe Deneyimi (bugünkü pist+zemin+mesafede kanıtlanmış geçmiş — deneysel, kanıtlanmamış)",
    scoreFn: zeminMesafeDeneyimiScoreFn,
  },
  // 2026-09-16 — Anormal Pist Modu v1 (bkz. src/lib/methodology/pist-dayanikliligi.ts
  // ve anormal-pist-risk.ts): İstanbul "Çim: Çok Ağır" günündeki K1/K2 kaybı sonrası,
  // zeminToleransi'nin anormal-pist GÜNLERİNDE production'dakinden daha güçlü/zayıf
  // ağırlıklandırılsaydı ne olurdu sorusunu ÖLÇMEK için 5 noktalı bir ölçek taraması
  // (0/0.5/1/1.5/2x). 1x = champion'ın birebir kopyası (v6-aa-sanity ile aynı rol,
  // ayrıca bir sağlık kontrolü). Point-in-time bulgu (12 geçmiş anormal-çim koşusu,
  // 3 gün) yönü doğru ama n=3 gün-kümesi istatistiksel güven için YETERSİZ — bu
  // yüzden HENÜZ production'a ALINMIYOR, yalnız gölge-testte biriktiriliyor. Gate
  // eşiği (≥30 koşu VE ≥6 farklı anormal gün, gün-kümeli bootstrap, ΔLogLoss) proje
  // planında dondurulmuştur.
  ...PIST_OLCEK_GRID.map(
    (olcek): ChallengerDef => ({
      key: `v6-zemin-toleransi-olcek-${olcek}x`,
      label: `Zemin Toleransı ${olcek}× Ölçekli (Anormal Pist Modu — deneysel, kanıtlanmamış)`,
      scoreFn: async (faz1) => zeminToleransiOlcekli(faz1, olcek),
    })
  ),
];
