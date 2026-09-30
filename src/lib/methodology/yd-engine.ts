/**
 * Analiz Motoru YD V1.0 — Yurt Dışı (ABD/İngiltere/Kanada) koşuları için analiz motoru.
 *
 * V5.46'DAN TAMAMEN BAĞIMSIZ (kullanıcı kararı, 2026-09-29/30, defalarca tekrarlandı):
 * ayrı dosya, ayrı veri kaynağı, ayrı depolama (YurtDisiPrediction/YurtDisiPick), TR
 * kodundan hiçbir import YOK, TR kodu bu dosyadan hiçbir şey import ETMİYOR.
 *
 * KRİTİK FARK — V5.46 yıllar içinde biriken binlerce TR sonucu üzerinde backtest edilip
 * kalibre edilmiş bir modeldir (bkz. feedback_champion_challenger_logloss_birincil).
 * YD V1.0'ın ise henüz HİÇ geçmiş sonuç (Result) verisi yok — ingest bugün (2026-09-30)
 * düzeltildi. Bu yüzden burada aşağıdaki ağırlıklar ("AGIRLIKLAR") istatistiksel olarak
 * FİT EDİLMEMİŞ, yalnız mantıklı/açıklanabilir başlangıç değerleridir — sonuç verisi
 * biriktikçe (bkz. feedback_yenilik_once_backtest) gerçek bir kalibrasyon/backtest ile
 * güncellenmesi gerekir. Bu yüzden puan "kazanma olasılığı" olarak SUNULMAZ, yalnız
 * sıralama amaçlı bir SKOR'dur.
 *
 * Veri kaynağı: tjk-at-yurtdisi.adapter.ts'in doldurduğu YurtDisiAtRaceHistoryCache
 * (rowsJson: geçmiş yarış satırları, profileJson: kimlik+pist bazlı kariyer özeti) +
 * bugünün Runner satırındaki AGF/HP. Accurace/galop video gibi TR'ye özgü sinyaller hiç
 * kullanılmaz (yurt dışı atlarda bu veriler yok).
 */

import type { YurtDisiAtKosuRow, YurtDisiAtProfil } from "@/server/services/ingest/tjk-at-yurtdisi.adapter";

export const YD_ENGINE_VERSION = "YD-1.0";

export type YdSinyalDetay = {
  puan: number; // 0-100
  aciklama: string;
};

export type YdSinyaller = {
  piyasa: YdSinyalDetay;
  form: YdSinyalDetay;
  pistUygunluk: YdSinyalDetay;
  ikramiyeTrend: YdSinyalDetay;
  tazelik: YdSinyalDetay;
};

export type YdRunnerGirdi = {
  runnerId: string;
  no: number;
  name: string;
  agf: number | null;
  surface: "CIM" | "KUM" | "SENTETIK";
  rows: YurtDisiAtKosuRow[]; // en yeni önce (adapter'ın kendi sırası)
  profile: YurtDisiAtProfil | null;
  bugun: Date;
};

export type YdSonuc = {
  runnerId: string;
  no: number;
  name: string;
  toplamPuan: number;
  sinyaller: YdSinyaller;
};

// Nihai puana katkı oranları — bkz. dosya başındaki KALİBRASYON notu.
const AGIRLIKLAR = {
  piyasa: 0.40,
  form: 0.25,
  pistUygunluk: 0.20,
  ikramiyeTrend: 0.10,
  tazelik: 0.05,
} as const;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// ─── 1. Piyasa (AGF) ───────────────────────────────────────────────────────────

function piyasaPuani(agf: number | null, sahaOrtalamasi: number): YdSinyalDetay {
  if (agf == null) {
    return { puan: sahaOrtalamasi, aciklama: "AGF verisi yok, saha ortalaması varsayıldı" };
  }
  return { puan: clamp(agf, 0, 100), aciklama: `Güncel AGF payı %${agf.toFixed(1)}` };
}

// ─── 2. Form (son yarışlar) ─────────────────────────────────────────────────────

// Yeni→eski sıra (adapter'ın kendi sırası) — en yeni yarış en çok ağırlığı taşır.
const FORM_AGIRLIKLARI = [0.35, 0.25, 0.18, 0.12, 0.07, 0.03];

function finishPuani(finish: string): number | null {
  const m = finish.match(/^(\d+)\/(\d+)$/);
  if (!m) return null;
  const pos = parseInt(m[1], 10);
  const saha = parseInt(m[2], 10);
  if (pos === 0) return 15; // TJK'nın "0" ile işaretlediği düzensiz/DNF benzeri sonuç
  if (pos === 1) return 100;
  if (pos === 2) return 82;
  if (pos === 3) return 68;
  // Saha büyüklüğüne göre orantılı düşüş — 4. sıradan sonrası saf pozisyona değil,
  // sahadaki GÖRECELİ konuma göre puanlanır (7 atlı bir sahada 4. olmak, 18 atlı bir
  // sahada 4. olmaktan farklı bir performanstır).
  const goreliOran = saha > 3 ? 1 - (pos - 3) / (saha - 3) : 0.3;
  return clamp(30 * goreliOran, 5, 55);
}

function formPuaniHesapla(rows: YurtDisiAtKosuRow[]): YdSinyalDetay {
  const son6 = rows.slice(0, 6);
  let toplamAgirlik = 0;
  let toplamPuan = 0;
  const kullanilan: number[] = [];
  son6.forEach((row, i) => {
    const p = finishPuani(row.finish);
    if (p == null) return;
    const agirlik = FORM_AGIRLIKLARI[i] ?? 0.02;
    toplamPuan += p * agirlik;
    toplamAgirlik += agirlik;
    kullanilan.push(p);
  });
  if (toplamAgirlik === 0) return { puan: 50, aciklama: "Form verisi yok, nötr varsayıldı" };
  const puan = toplamPuan / toplamAgirlik;
  return { puan: clamp(puan, 0, 100), aciklama: `Son ${kullanilan.length} yarış form puanı ${puan.toFixed(0)}/100` };
}

// ─── 3. Pist uygunluğu (kariyer, pist bazlı) ───────────────────────────────────

const SURFACE_TO_TJK_LABEL: Record<YdRunnerGirdi["surface"], string> = {
  CIM: "Çim",
  KUM: "Kum",
  SENTETIK: "Sentetik",
};

function pistUygunlukPuaniHesapla(profile: YurtDisiAtProfil | null, surface: YdRunnerGirdi["surface"]): YdSinyalDetay {
  if (!profile) return { puan: 50, aciklama: "Kariyer istatistiği yok, nötr varsayıldı" };
  const label = SURFACE_TO_TJK_LABEL[surface];
  const pist = profile.ozet[label];
  const toplam = profile.ozet["TOPLAM"];
  const pistOran = pist && pist.starts > 0 ? pist.wins / pist.starts : null;
  const toplamOran = toplam && toplam.starts > 0 ? toplam.wins / toplam.starts : null;

  if (pistOran == null && toplamOran == null) {
    return { puan: 50, aciklama: "Kariyer istatistiği yok, nötr varsayıldı" };
  }
  if (pistOran == null) {
    return { puan: clamp(toplamOran! * 100, 0, 100), aciklama: `${label} geçmişi yok, genel kariyer oranı %${(toplamOran! * 100).toFixed(0)} kullanıldı` };
  }
  // Az sayıda pist-spesifik start güvenilmez olabilir — genel orana doğru yumuşak çekilir
  // (sert bir "3'ten az sayılmaz" eşiği YOK, güven payı start sayısıyla SÜREKLİ artar).
  const guven = clamp(pist!.starts / 5, 0, 1);
  const karisikOran = guven * pistOran + (1 - guven) * (toplamOran ?? pistOran);
  const puan = clamp(karisikOran * 100, 0, 100);
  return {
    puan,
    aciklama: `${label}'de kariyer: ${pist!.starts} start, %${(pistOran * 100).toFixed(0)} galibiyet oranı`,
  };
}

// ─── 4. İkramiye trendi (sınıf momentumu) ──────────────────────────────────────

function paraninSayisi(raw: string): number | null {
  const n = parseInt(raw.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function ikramiyeTrendPuaniHesapla(rows: YurtDisiAtKosuRow[]): YdSinyalDetay {
  const tutarlar = rows.slice(0, 6).map((r) => paraninSayisi(r.purse)).filter((n): n is number => n != null);
  if (tutarlar.length < 2) return { puan: 50, aciklama: "Yeterli ikramiye geçmişi yok, nötr varsayıldı" };

  const yariNokta = Math.ceil(tutarlar.length / 2);
  const yeniOrt = tutarlar.slice(0, yariNokta).reduce((a, b) => a + b, 0) / yariNokta;
  const eskiOrt = tutarlar.slice(yariNokta).reduce((a, b) => a + b, 0) / (tutarlar.length - yariNokta);
  if (eskiOrt === 0) return { puan: 50, aciklama: "İkramiye trendi hesaplanamadı" };

  const oran = clamp(yeniOrt / eskiOrt, 0.2, 3);
  const puan = clamp(50 + (oran - 1) * 50, 0, 100);
  const yon = oran > 1.08 ? "yükseliş" : oran < 0.92 ? "düşüş" : "sabit";
  return { puan, aciklama: `Son yarışlarda ikramiye seviyesi ${yon} eğiliminde (oran ${oran.toFixed(2)})` };
}

// ─── 5. Tazelik (son yarıştan bu yana geçen gün) ───────────────────────────────

function parseYurtDisiDate(dmy: string): Date | null {
  const [d, m, y] = dmy.split(".");
  if (!d || !m || !y) return null;
  return new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T00:00:00.000Z`);
}

// Sürekli (hard-cutoff olmayan) parçalı-doğrusal ilişki — 4 demir nokta arasında
// enterpolasyon: çok yakın zamanda koşmuş (yorgunluk riski) < ideal 3-8 hafta < uzun mola.
const TAZELIK_ANKORLARI: [gun: number, puan: number][] = [
  [0, 55], [10, 70], [25, 85], [60, 72], [120, 55], [365, 38],
];

function tazelikPuaniHesapla(rows: YurtDisiAtKosuRow[], bugun: Date): YdSinyalDetay {
  const enSon = rows[0];
  if (!enSon) return { puan: 50, aciklama: "Geçmiş yarış yok, nötr varsayıldı" };
  const tarih = parseYurtDisiDate(enSon.date);
  if (!tarih) return { puan: 50, aciklama: "Son yarış tarihi ayrıştırılamadı" };

  const gun = Math.round((bugun.getTime() - tarih.getTime()) / 86_400_000);
  if (gun < 0) return { puan: 50, aciklama: "Tarih tutarsızlığı" };

  let puan = TAZELIK_ANKORLARI[TAZELIK_ANKORLARI.length - 1][1];
  for (let i = 0; i < TAZELIK_ANKORLARI.length - 1; i++) {
    const [g1, p1] = TAZELIK_ANKORLARI[i];
    const [g2, p2] = TAZELIK_ANKORLARI[i + 1];
    if (gun >= g1 && gun <= g2) {
      const oran = (gun - g1) / (g2 - g1);
      puan = p1 + (p2 - p1) * oran;
      break;
    }
  }
  return { puan: clamp(puan, 0, 100), aciklama: `Son yarıştan bu yana ${gun} gün geçmiş` };
}

// ─── Bileşke ────────────────────────────────────────────────────────────────────

/** Bir koşudaki TÜM atlar için YD V1.0 skorunu hesaplar (sıralama YAPMAZ — çağıran karar verir). */
export function ydSkorHesapla(runners: YdRunnerGirdi[]): YdSonuc[] {
  const agfDegerleri = runners.map((r) => r.agf).filter((a): a is number => a != null);
  const sahaOrtalamasi = agfDegerleri.length > 0 ? 100 / runners.length : 100 / runners.length;

  return runners.map((r) => {
    const piyasa = piyasaPuani(r.agf, sahaOrtalamasi);
    const form = formPuaniHesapla(r.rows);
    const pistUygunluk = pistUygunlukPuaniHesapla(r.profile, r.surface);
    const ikramiyeTrend = ikramiyeTrendPuaniHesapla(r.rows);
    const tazelik = tazelikPuaniHesapla(r.rows, r.bugun);

    const toplamPuan =
      piyasa.puan * AGIRLIKLAR.piyasa +
      form.puan * AGIRLIKLAR.form +
      pistUygunluk.puan * AGIRLIKLAR.pistUygunluk +
      ikramiyeTrend.puan * AGIRLIKLAR.ikramiyeTrend +
      tazelik.puan * AGIRLIKLAR.tazelik;

    return {
      runnerId: r.runnerId,
      no: r.no,
      name: r.name,
      toplamPuan: Math.round(toplamPuan * 10) / 10,
      sinyaller: { piyasa, form, pistUygunluk, ikramiyeTrend, tazelik },
    };
  });
}
