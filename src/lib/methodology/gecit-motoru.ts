/**
 * ROTAGANYAN — SIRALAMA-ÖNCESİ ZORUNLU GEÇİT
 * gecit-motoru.ts · v4.0 → TypeScript taşıması
 *
 * Kullanıcının ChatGPT Custom GPT'sinde çalıştırdığı `gecit_core.py`'nin birebir
 * mantıksal taşımasıdır — eşikler, sinyal isimleri, yasak gerekçeler, geçit skoru
 * formülü AYNIDIR. Girdiler burada MANUEL doldurulmaz; `veri-toplama.ts` bu
 * girdileri sitenin kendi verisinden (HP geçmişi, form dizisi, tempo örneklemi,
 * takı değişikliği, galop zinciri, jokey/antrenör istatistiği) otomatik türetir.
 */

export const VERSION = "4.0-ts";

export type AfSinyal =
  | "kiloAvantaji"
  | "takiUygun"
  | "startTempoUygun"
  | "exactVeyaPedigri"
  | "kondisyonZinciri"
  | "sinifJokeyAntrenor";

export const AF_SINYAL: AfSinyal[] = [
  "kiloAvantaji", "takiUygun", "startTempoUygun",
  "exactVeyaPedigri", "kondisyonZinciri", "sinifJokeyAntrenor",
];

export const ESIK = {
  atomicForceMin: 4,
  agfIlkN: 3,
  agfSapmaMin: 2,
  kuponDerinligi: 6,
  cozumBandi: 4,
  hpPatlamaMin: 10,
  hpYukselisMin: 4,
  hpDususMin: -4,
  tempoMinN: 5,
  kalabalikSahaEsik: 15,
  kalabalikZayifOran: 0.4,
  // ── Son 800 — Gölge Mod (v4.0) ──
  son800MinN: 3,
  son800GucluEsik: -0.5,
  son800ZayifEsik: 0.7,
} as const;

export type Esikler = typeof ESIK;

export type CozumGirdisi = { exactDisiKanit?: boolean; gerekce?: string };

export type AtGirdisi = {
  ad: string;
  teknikSira?: number | null;
  agfSirasi?: number | null;
  bc: number;
  hpBugun?: number | null;
  hpOnceki?: number | null;
  ilkStart?: boolean;
  bitirisGeriliyor?: boolean | null;
  bitirisIyilesiyor?: boolean | null;
  tempoVeriN?: number | null;
  kacak?: boolean;
  atomicForce?: Partial<Record<AfSinyal, boolean>>;
  negatifGerekceler?: string[];
  cozum?: CozumGirdisi;
  sinifDususu?: boolean;
  hpAlanIciUst?: boolean;
  sonSonucZayif?: boolean;
  keskinGalopZinciri?: boolean;
  // Son 800 gölge mod girdileri
  son800Farki?: number | null;
  son800BenzerKosuN?: number;
  son800Medyan?: number | null;
};

export type KosuGirdisi = {
  ad?: string;
  kuponDerinligi?: number;
  sahadakiKacakSayisi?: number;
  kalabalik?: boolean;
  kalabalikSaha?: boolean;
  atSayisi?: number;
};

export type GecitTetik = { gecit: string; etiket: string; eylem: string };

export type AtSonucu = {
  at: string;
  teknikSira: number | null | undefined;
  atomicForceSayi: number;
  hpIvmesi: number | null;
  bc: number;
  bcHam: number;
  kalabalikEklenti: number;
  son800Bonus: number;
  son800Ozet: string;
  son800Farki: number | null | undefined;
  son800Medyan: number | null | undefined;
  son800N: number;
  tetikler: GecitTetik[];
  tetikliyor: boolean;
  uyarilar: string[];
  gomulu: boolean;
  alarm: boolean;
  yasakGerekce: string[];
  piyasaSeviyor: boolean;
  veriToplamaHatasi: boolean;
  ilkStart: boolean;
  cozumGerekli: boolean;
  cozumEksik: boolean;
  gecitSkoru?: number;
};

export const YASAK_NEGATIF: Record<string, string> = {
  jokey_dusuk_yuzde:
    "Jokey/antrenör düşük yüzdesi NEGATİF DEĞİLDİR — sadece 'olumlu kanıt yok' demektir. Ceza gerekçesi olamaz.",
  form_dalgalanmasi:
    "Handikapta form dalgalanması NORMALDİR — sistemin tasarım amacı budur (iyi koşan ağırlaşır). Ceza gerekçesi olamaz.",
  h2h_maglubiyet:
    "Geçmiş karşılaşma ZAYIF kanıttır — kilo/takı/mesafe/form değişmiş olabilir. Tek başına atı geriye itemez.",
  exact_yok:
    "Kanıt yokluğu ≠ olumsuz kanıt. 'Bu pistte koşmamış' ≠ 'bu pistte kötü koşmuş'.",
  tek_start:
    "Az sicil ≠ kötü sicil. Örneklem küçüklüğü yalnız Veri Güveni'nde cezalandırılır, puanda İKİNCİ KEZ değil.",
  hp_ivmesi_bilinmiyor:
    "Veri eksikliği ceza sebebi değildir — kör nokta olarak işaretlenir, atı geriye itmez.",
};

function say(af: Partial<Record<AfSinyal, boolean>> | undefined): number {
  return AF_SINYAL.reduce((n, k) => n + (af?.[k] ? 1 : 0), 0);
}

export function hpIvmesi(at: AtGirdisi): number | null {
  const b = at.hpBugun, o = at.hpOnceki;
  if (b == null || o == null) return null;
  return b - o;
}

export type Son800Sonuc = "guclu_kapanis" | "dusuk_tempo" | "sinyal_yetersiz" | "notr";

export function son800Ozet(at: AtGirdisi, esik: Esikler = ESIK): Son800Sonuc {
  const n = at.son800BenzerKosuN ?? 0;
  const med = at.son800Medyan;
  if (n < esik.son800MinN || med == null) return "sinyal_yetersiz";
  if (med <= esik.son800GucluEsik) return "guclu_kapanis";
  if (med >= esik.son800ZayifEsik) return "dusuk_tempo";
  return "notr";
}

export function atiDegerlendir(at: AtGirdisi, kosu: KosuGirdisi, esik: Esikler = ESIK): AtSonucu {
  const kupon = kosu.kuponDerinligi ?? esik.kuponDerinligi;
  const tek = at.teknikSira;
  const tetikler: GecitTetik[] = [];

  const bcHam = at.bc ?? 0;
  const kalabalik = kosu.kalabalik || kosu.kalabalikSaha || false;

  const s800 = son800Ozet(at, esik);
  const son800Bonus = s800 === "guclu_kapanis" ? 2 : s800 === "dusuk_tempo" ? -1 : 0;

  let bcEfektif: number;
  if (kalabalik) {
    const tempoUygun = !!at.atomicForce?.startTempoUygun;
    bcEfektif = bcHam + (tempoUygun ? 5 : 0) + son800Bonus;
  } else {
    bcEfektif = bcHam + son800Bonus;
  }

  const af = say(at.atomicForce);
  if (af >= esik.atomicForceMin) {
    tetikler.push({
      gecit: "ATOMIC_FORCE", etiket: `Atomic Force ${af}/6`,
      eylem: "Ekonomik kupon + ilk 4 yeniden değerlendirme zorunlu.",
    });
  }

  if (kosu.sahadakiKacakSayisi === 1 && at.kacak) {
    tetikler.push({ gecit: "TEK_KACAK", etiket: "Tek net kaçak", eylem: "Net Rota'da ayrıca işaretle." });
  }

  if (at.sonSonucZayif && at.keskinGalopZinciri) {
    tetikler.push({ gecit: "GIZLI_TOPARLANMA", etiket: "Gizli toparlanma", eylem: "\"Formu zayıf\" etiketi YASAK." });
  }

  const iv = hpIvmesi(at);
  const ilkStart = !!at.ilkStart;
  const veriToplamaHatasi = iv == null && !ilkStart;
  if (iv != null && iv >= esik.hpPatlamaMin) {
    tetikler.push({
      gecit: "HP_PATLAMA", etiket: `HP ivmesi ${iv >= 0 ? "+" : ""}${iv}`,
      eylem: "HANDİKAPÇI GECİKMESİ: at resmî değerlendirmesinin ÖNÜNDE. Ekonomik kupona zorunlu.",
    });
  }

  if (at.bitirisGeriliyor && iv != null && iv >= esik.hpYukselisMin) {
    tetikler.push({
      gecit: "GIZLI_GUC", etiket: `Gizli güç (bitiriş↓ / HP ${iv >= 0 ? "+" : ""}${iv}↑)`,
      eylem: 'Bu at GERİLEMİYOR, SINIF ATLIYOR. Kilosu ağırlaştığı için dereceleri kötüleşiyor. "Formu düşüyor" demek YASAK.',
    });
  }

  const agf = at.agfSirasi;
  let agfAyrisma = false;
  if (agf != null && tek != null && agf <= esik.agfIlkN && (tek - agf) >= esik.agfSapmaMin) {
    agfAyrisma = true;
    tetikler.push({
      gecit: "AGF_AYRISMA", etiket: `AGF ayrışma (AGF ${agf}/teknik ${tek})`,
      eylem: "ZORUNLU: ilk 4'e taşı. Gerekçeyle çözülemez.",
    });
  }

  if (at.sinifDususu && at.hpAlanIciUst) {
    tetikler.push({ gecit: "HP_SINIF", etiket: "HP × sınıf", eylem: "Sınıf bonusu bir kademe yükselt." });
  }

  const uyarilar: string[] = [];

  const yasakKullanilan = (at.negatifGerekceler ?? []).filter((g) => g in YASAK_NEGATIF);
  for (const g of yasakKullanilan) uyarilar.push(`YASAK GEREKCE '${g}': ${YASAK_NEGATIF[g]}`);

  const agfS = at.agfSirasi;
  const piyasaSeviyor = agfS != null && agfS <= esik.agfIlkN;

  const n = at.tempoVeriN;
  if (n != null && n < esik.tempoMinN) {
    if (at.atomicForce?.startTempoUygun) {
      uyarilar.push(
        `TEMPO ÖRNEKLEMİ ZAYIF (n=${n} < ${esik.tempoMinN}): 'startTempoUygun' sinyali bu veriyle TEK BAŞINA doğrulanamaz. ` +
        "Ya kulvar/mesafe gibi bağımsız bir kanıtla destekle, ya da sinyali FALSE yap. Veri Güvenini de düşür."
      );
    } else {
      uyarilar.push(`Tempo örneklemi zayıf (n=${n}) — stil yüzdeleri güvenilmez.`);
    }
  }
  if (at.kacak && n != null && n < esik.tempoMinN) {
    uyarilar.push(`KAÇAK ETİKETİ ŞÜPHELİ (n=${n}): kaçak olduğu ${n} yarışa dayanıyor.`);
  }

  if (at.bitirisIyilesiyor && iv != null && iv <= esik.hpDususMin) {
    uyarilar.push(
      `YANILTICI FORM: bitirişler iyi ama HP ${iv >= 0 ? "+" : ""}${iv} (sınıfı geriliyor). ` +
      "İyi dereceleri DÜŞÜRÜLMÜŞ sınıfta aldı. İlk 3'e koyacaksan gerekçe yaz."
    );
  }
  if (veriToplamaHatasi) {
    uyarilar.push(
      "VERI TOPLAMA HATASI (kör nokta DEGIL): Bu at daha once yaris kosmus, yani P-HP'si VAR. " +
      "TJK 'At Kosu Bilgileri' sayfasindan atin HERHANGI BIR pistteki son yarisinin P-HP'sini al. " +
      "Bulunabilecek veriyi 'yok' sayip ati geriye itmek YASAKTIR."
    );
  } else if (iv == null && ilkStart) {
    uyarilar.push("HP-IVMESI-YOK");
  }

  const gomulu = tek != null && tek > kupon;
  const cozum = at.cozum ?? {};
  const cozumGerekli = tetikler.length > 0 && tek != null && tek > esik.cozumBandi;

  let cozumEksik: boolean;
  if (veriToplamaHatasi && tek != null && tek > esik.cozumBandi) {
    cozumEksik = true;
  } else if (yasakKullanilan.length > 0 && tek != null && tek > esik.cozumBandi) {
    cozumEksik = true;
  } else if (agfAyrisma && tek != null && tek > esik.cozumBandi) {
    cozumEksik = true;
  } else {
    cozumEksik = cozumGerekli && !(cozum.exactDisiKanit && (cozum.gerekce ?? "").trim());
  }

  return {
    at: at.ad || "(isimsiz)", teknikSira: tek,
    atomicForceSayi: af, hpIvmesi: iv, bc: bcEfektif, bcHam,
    kalabalikEklenti: bcEfektif - bcHam - son800Bonus,
    son800Bonus, son800Ozet: s800,
    son800Farki: at.son800Farki, son800Medyan: at.son800Medyan, son800N: at.son800BenzerKosuN ?? 0,
    tetikler, tetikliyor: tetikler.length > 0, uyarilar,
    gomulu, alarm: tetikler.length > 0 && gomulu,
    yasakGerekce: yasakKullanilan, piyasaSeviyor,
    veriToplamaHatasi, ilkStart,
    cozumGerekli, cozumEksik,
  };
}

export type VeriDenetimSatiri = { alan: string; ad: string; dolu: number; toplam: number; oran: number; yeterli: boolean };
export type VeriDenetimSonucu = { yeterli: boolean; eksikler: string[]; rapor: VeriDenetimSatiri[] };

export function veriDenetimi(atlar: AtGirdisi[], _esik: Esikler = ESIK): VeriDenetimSonucu {
  const n = atlar.length || 1;
  const kritik: [keyof AtGirdisi, string, number][] = [
    ["hpBugun", "Bugünkü HP", 0.90],
    ["hpOnceki", "Geçmiş P-HP (HP ivmesi için)", 0.90],
    ["tempoVeriN", "Tempo örneklem sayısı (VERİ sütunu)", 0.90],
    ["agfSirasi", "AGF sırası", 0.90],
  ];
  const rapor: VeriDenetimSatiri[] = [];
  const eksikler: string[] = [];
  for (const [alan, ad, gerek] of kritik) {
    const dolu = atlar.filter((a) => (a as Record<string, unknown>)[alan as string] != null).length;
    const oran = dolu / n;
    rapor.push({ alan: alan as string, ad, dolu, toplam: n, oran: Math.round(oran * 100) / 100, yeterli: oran >= gerek });
    if (oran < gerek) eksikler.push(`${ad}: ${dolu}/${n} (%${Math.round(oran * 100)}) — en az %${Math.round(gerek * 100)} gerekli`);
  }

  const formDolu = atlar.filter((a) => a.bitirisGeriliyor != null || a.bitirisIyilesiyor != null).length;
  const formOran = formDolu / n;
  rapor.push({ alan: "form_catali", ad: "Form yönü (bitiriş geriliyor/iyileşiyor)", dolu: formDolu, toplam: n, oran: Math.round(formOran * 100) / 100, yeterli: formOran >= 0.90 });
  if (formOran < 0.90) {
    eksikler.push(`Form yönü: ${formDolu}/${n} (%${Math.round(formOran * 100)}) — FORM ÇATALI ÇALIŞMIYOR.`);
  }

  return { yeterli: eksikler.length === 0, eksikler, rapor };
}

export function gecitSkoru(r: AtSonucu): number {
  let s = r.atomicForceSayi * 2 + r.tetikler.length * 3 + r.bc / 5;
  if (r.hpIvmesi != null && r.hpIvmesi >= ESIK.hpPatlamaMin) s += 6;
  return Math.round(s * 10) / 10;
}

export type Durum = "VERI_YETERSIZ" | "ALARM" | "COZUM_EKSIK" | "KONTROL" | "TEMIZ";

export type DegerlendirSonucu = {
  versiyon: string;
  durum: Durum;
  uyari: string | null;
  esik: Esikler;
  veriDenetimi: VeriDenetimSonucu;
  satirlar: AtSonucu[];
  alarmlar: AtSonucu[];
  cozumBekleyen: AtSonucu[];
  izlemeler: AtSonucu[];
  notlar: string[];
  tamamlanabilir: boolean;
};

export function degerlendir(girdi: { kosu?: KosuGirdisi; atlar?: AtGirdisi[]; esik?: Partial<Esikler> }): DegerlendirSonucu {
  const kosu = girdi.kosu ?? {};
  const atlar = girdi.atlar ?? [];
  const esik: Esikler = { ...ESIK, ...(girdi.esik ?? {}) };
  const kupon = kosu.kuponDerinligi ?? esik.kuponDerinligi;

  const atSayisi = atlar.length;
  const kalabalik = atSayisi >= (esik.kalabalikSahaEsik ?? 15);
  const ctx: KosuGirdisi = {
    sahadakiKacakSayisi: kosu.sahadakiKacakSayisi,
    kuponDerinligi: kupon,
    kalabalikSaha: kalabalik,
    atSayisi,
  };

  const satirlar = atlar.map((a) => atiDegerlendir(a, ctx, esik));
  for (const r of satirlar) r.gecitSkoru = gecitSkoru(r);

  const vd = veriDenetimi(atlar, esik);

  const alarmlar = satirlar.filter((r) => r.alarm);
  const cozumBekleyen = satirlar.filter((r) => r.cozumEksik);
  const izlemeler = satirlar.filter((r) => r.tetikliyor && !r.gomulu);

  let durum: Durum;
  if (!vd.yeterli) durum = "VERI_YETERSIZ";
  else if (alarmlar.length > 0) durum = "ALARM";
  else if (cozumBekleyen.length > 0) durum = "COZUM_EKSIK";
  else if (izlemeler.length > 0) durum = "KONTROL";
  else durum = "TEMIZ";

  let uyari: string | null = null;
  if (durum === "VERI_YETERSIZ") {
    uyari = "VERI YETERSIZ — ANALIZ BASLATILAMAZ.\n   " + vd.eksikler.map((e) => "• " + e).join("\n   ");
  } else if (durum === "ALARM") {
    uyari = `GECIT ALARMI: ${alarmlar.length} at kupon disinda ama gecit tetikliyor. ANALIZ TAMAMLANMADI (H36).`;
  } else if (durum === "COZUM_EKSIK") {
    const agfOlanlar = cozumBekleyen.filter((r) => r.tetikler.some((t) => t.gecit === "AGF_AYRISMA")).map((r) => r.at);
    const diger = cozumBekleyen.filter((r) => !agfOlanlar.includes(r.at)).map((r) => r.at);
    const parcalar: string[] = [];
    if (agfOlanlar.length > 0) parcalar.push(`AGF ayrismasi (gerekce KABUL EDILMEZ, ilk ${esik.cozumBandi}'e TASINMALI): ${agfOlanlar.join(", ")}`);
    if (diger.length > 0) parcalar.push(`digerleri (exact DISI kanitla cozulebilir): ${diger.join(", ")}`);
    uyari = "COZUM EKSIK (H37): " + parcalar.join(" | ");
  } else if (durum === "KONTROL") {
    uyari = `${izlemeler.length} at gecit tetikliyor (kupon icinde). Gerekceleri isle.`;
  }

  const notlar: string[] = [];
  const tetikli = satirlar.filter((r) => r.tetikliyor).length;
  if (tetikli > esik.cozumBandi) {
    notlar.push(`BANT TASMASI: ${tetikli} at tetikliyor, bant ilk ${esik.cozumBandi}. GECIT SKORU yuksek olani one al.`);
  }
  const zayif = atlar.filter((a) => a.tempoVeriN != null && a.tempoVeriN < esik.tempoMinN).map((a) => a.ad);
  if (zayif.length > 0) {
    notlar.push(`TEMPO ORNEKLEMI ZAYIF (n<${esik.tempoMinN}): ${zayif.join(", ")} — stil yuzdeleri bu atlarda GURULTU.`);
  }
  const hata = satirlar.filter((r) => r.veriToplamaHatasi).map((r) => r.at);
  if (hata.length > 0) {
    notlar.push(`VERI TOPLAMA HATASI: ${hata.join(", ")} — bu atlar daha once yaris kosmus, P-HP'leri VAR ama toplanmamis.`);
  }
  const gercekKor = satirlar.filter((r) => r.hpIvmesi == null && r.ilkStart).map((r) => r.at);
  if (gercekKor.length > 0) {
    notlar.push(`GERCEK KOR NOKTA (ilk start, P-HP olusmamis): ${gercekKor.join(", ")}`);
  }

  if (atSayisi >= esik.kalabalikSahaEsik) {
    const kacakAdaylari = atlar.filter((a) => a.kacak);
    if (kacakAdaylari.length >= 2) {
      const enGuvenilirN = Math.max(...kacakAdaylari.map((a) => a.tempoVeriN ?? 0));
      if (enGuvenilirN < 10) {
        const adlar = kacakAdaylari.map((a) => a.ad).join(", ");
        notlar.push(
          `KALABALIK SAHA (${atSayisi} at): ${kacakAdaylari.length} kacak adayi var (${adlar}) ama HICBIRI n>=10 ` +
          `guvenilir bandinda degil (en yuksegi n=${enGuvenilirN}). Net tek kacak ilan etmeden once iki kez kontrol et.`
        );
      }
    }
  }

  return {
    versiyon: VERSION, durum, uyari, esik, veriDenetimi: vd,
    satirlar, alarmlar, cozumBekleyen, izlemeler, notlar,
    tamamlanabilir: !(["ALARM", "COZUM_EKSIK", "VERI_YETERSIZ"] as Durum[]).includes(durum),
  };
}

export function ekonomikKupon(
  ayaklar: Record<string, AtSonucu[]>,
  maksKombinasyon = 300,
  maksSlot = 5
): { slot: Record<string, number>; maliyet: number; belirsizlik: Record<string, number>; kupon: Record<string, string[]> } {
  function belirsizlik(rs: AtSonucu[]): number {
    let b = rs.filter((r) => r.tetikliyor).length * 2;
    rs.forEach((r, i) => {
      if (i >= 2 && r.tetikliyor) b += (r.gecitSkoru ?? 0) / 3;
    });
    return Math.round(b * 10) / 10;
  }

  const ayakAdlari = Object.keys(ayaklar);
  const bel: Record<string, number> = {};
  const slot: Record<string, number> = {};
  for (const a of ayakAdlari) { bel[a] = belirsizlik(ayaklar[a]); slot[a] = 1; }

  function maliyet(): number {
    return ayakAdlari.reduce((m, a) => m * slot[a], 1);
  }

  for (;;) {
    const aday = ayakAdlari.filter((a) => slot[a] < Math.min(maksSlot, ayaklar[a].length));
    if (aday.length === 0) break;
    const hedef = aday.reduce((best, a) => (bel[a] / slot[a] > bel[best] / slot[best] ? a : best), aday[0]);
    slot[hedef] += 1;
    if (maliyet() > maksKombinasyon) { slot[hedef] -= 1; break; }
  }

  const secim: Record<string, string[]> = {};
  for (const a of ayakAdlari) {
    const tetikli = ayaklar[a].filter((r) => r.tetikliyor).sort((x, y) => (y.gecitSkoru ?? 0) - (x.gecitSkoru ?? 0));
    const diger = ayaklar[a].filter((r) => !r.tetikliyor);
    secim[a] = [...tetikli, ...diger].slice(0, slot[a]).map((r) => r.at);
  }

  return { slot, maliyet: maliyet(), belirsizlik: bel, kupon: secim };
}

export type PostMortemSonuc = { hata: string } | { sinif: "KIRMIZI" | "TURUNCU-KIRMIZI" | "SARI" | "TURUNCU"; baslik: string; kuralCikar: boolean; aciklama: string };

export function postMortem(girdi: { kosu?: KosuGirdisi; atlar?: AtGirdisi[]; esik?: Partial<Esikler> }, kazanan: string): PostMortemSonuc {
  const s = degerlendir(girdi);
  const r = s.satirlar.find((x) => x.at === kazanan);
  if (!r) return { hata: `Kazanan bulunamadi: ${kazanan}` };
  if (r.tetikliyor && r.gomulu) {
    return {
      sinif: "KIRMIZI", baslik: "SUREC HATASI (H36)", kuralCikar: true,
      aciklama: `Gecit tetiklemisti (${r.tetikler.map((t) => t.etiket).join(", ")}) ama sira ${r.teknikSira} ile kupon disinda kaldi.`,
    };
  }
  if (r.tetikliyor && r.cozumEksik) {
    return {
      sinif: "TURUNCU-KIRMIZI", baslik: "KORUNDU AMA COZULMEDI (H37)", kuralCikar: false,
      aciklama: "Kupona alindi ama sira duzeltilmedi. Kupon kurtardi, siralama kurtarmadi.",
    };
  }
  if (r.tetikliyor) {
    return {
      sinif: "SARI", baslik: "KORUNDU — surec dogru isledi", kuralCikar: false,
      aciklama: `Gecit tetiklemisti (${r.tetikler.map((t) => t.etiket).join(", ")}) ve at kupondaydi.`,
    };
  }
  return {
    sinif: "TURUNCU", baslik: "VARYANS — surec hatasi DEGIL", kuralCikar: false,
    aciklama: "Hicbir gecit tetiklenmedi. Dusuk sirali at bazen kazanir; saglikli sistemde BEKLENIR. BUNDAN KURAL CIKARMA.",
  };
}

/** Kod çıktısını (metodolojideki "kod kanıtı" ilkesine uygun) okunabilir metin olarak üretir — Claude'a Faz 3 sonucu olarak geçirilir. */
export function metin(s: DegerlendirSonucu, ad = ""): string {
  function p(x: string | number, n: number): string {
    const str = String(x);
    return str.length >= n ? str.slice(0, n - 1) + " " : str + " ".repeat(n - str.length);
  }
  const L: string[] = [
    `SIRALAMA-ONCESI GECIT — ${ad || "(kosu)"}  [v${s.versiyon}]`,
    p("At", 15) + p("AF", 5) + p("HP-iv", 7) + p("Skor", 6) + p("Tetik", 32) + "Sira",
    "-".repeat(72),
  ];
  for (const r of s.satirlar) {
    const t = r.tetikler.map((x) => x.gecit).join(",") || "-";
    const iv = r.hpIvmesi != null ? (r.hpIvmesi >= 0 ? "+" : "") + r.hpIvmesi : "?";
    L.push(
      p(r.at, 15) + p(`${r.atomicForceSayi}/6`, 5) + p(iv, 7) + p(r.gecitSkoru ?? 0, 6) + p(t, 32) +
      (r.teknikSira != null ? String(r.teknikSira) : "-") + (r.gomulu ? " *" : "")
    );
  }
  L.push("");
  L.push(s.uyari || "OK Gecit temiz.");
  for (const r of s.satirlar) {
    for (const u of r.uyarilar) {
      if (u !== "HP-IVMESI-YOK") L.push(`  ${r.at}: ${u}`);
    }
  }
  for (const n of s.notlar) L.push("! " + n);

  const son800Notlar: string[] = [];
  for (const r of s.satirlar) {
    const ozet = r.son800Ozet;
    const n = r.son800N;
    const med = r.son800Medyan;
    const bon = r.son800Bonus;
    if (ozet === "guclu_kapanis") {
      son800Notlar.push(`  [SON800 +${bon}] ${r.at}: Güçlü kapanış örüntüsü (n=${n}, medyan ${(med ?? 0) >= 0 ? "+" : ""}${(med ?? 0).toFixed(2)}s) — B+C'ye +${bon} eklendi.`);
    } else if (ozet === "dusuk_tempo") {
      son800Notlar.push(`  [SON800 ${bon}] ${r.at}: Son 800 referanstan yavaş (n=${n}, medyan ${(med ?? 0) >= 0 ? "+" : ""}${(med ?? 0).toFixed(2)}s) — B+C'ye ${bon} eklendi.`);
    }
  }
  if (son800Notlar.length > 0) {
    L.push("\nSON 800 (B+C bileşeni — tempo satırına ek):");
    L.push(...son800Notlar);
  }

  return L.join("\n");
}
