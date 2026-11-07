/**
 * TJK "Detaylı Derece İstatistikleri" adaptörü — 2026-08-23.
 * Kaynak: https://www.tjk.org/TR/YarisSever/Query/Page/DetayliDereceIst
 * Ülke çapındaki TÜM koşu performanslarını (at/tarih/hipodrom/pist/PİST DURUMU/mesafe/
 * derece/koşu cinsi) veren arşiv. Amaç: kendi RaceDay.surfaceConditions verimiz çok seyrek
 * olduğu için (bkz. horse-detail.actions.ts notu), "zemin ağırlığı" (yağmurlu/ıslak pist)
 * sinyalini test edebilmek için zengin bir popülasyon referansı biriktirmek.
 *
 * Sayfalama: /TR/YarisSever/Query/DataRows/DetayliDereceIst?QueryParameter_Yil=N&PageNumber=M
 * (AJAX fragment, yalnız <tbody><tr>...) — cheerio bu fragment'i <table> sarmalı OLMADAN
 * doğru parse ETMİYOR (tbody, table dışında geçersiz sayılıp tr'ler kayboluyor), o yüzden
 * sarmalanarak yükleniyor. Her satırın "AtAdi" linkinde TJK'nın kendi kayıt kimliği
 * (#224900 gibi bir fragment) var — bu, tjkKayitId olarak doğal benzersiz anahtar.
 *
 * 2026-11-07 KÖK NEDEN DÜZELTMESİ (kullanıcı bulgusu, FENNAN — sonra TÜM atların ortalama
 * %27.8'e düştüğü görüldü): QueryParameter_SehirId'siz (ya da -1 ile) sorgu "ülke çapında
 * TÜMÜ" DEĞİL, TJK'nın sessizce ~10.650 sonuçta KESTİĞİ dar bir görünüm döndürüyormuş —
 * tek tek şehir ID'siyle (1=Adana, 2=İzmir... bkz. IDMAN_SEHIR_ID) sorgulayınca HER şehir
 * TEK BAŞINA bu sayıya yakın/daha fazla sonuç veriyor (10 şehrin toplamı gerçek rakamın
 * kat kat üstünde). Aynı kalıp daha önce İdman İstatistikleri'nde de yaşanmıştı (bkz.
 * tjk-idman-stats.adapter.ts başlık notu: "Liderform'un ana galop sayfası sadece o an öne
 * çıkan şehri listeliyordu") — bu adaptör o dersi uygulamamıştı. Artık senkron HER şehir
 * ID'si için AYRI AYRI tam sayfalanıyor, sonuçlar birleştiriliyor.
 */
import * as cheerio from "cheerio";
import { db } from "@/lib/db";
import { parseTjkDate } from "@/lib/tjk-date";
import { IDMAN_SEHIR_ID } from "./tjk-idman-stats.adapter";

const BASE = "https://www.tjk.org/TR/YarisSever/Query/DataRows/DetayliDereceIst";
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Referer: "https://www.tjk.org/TR/YarisSever/Query/Page/DetayliDereceIst",
};
const SAYFA_BOYU = 50;
const CONCURRENCY = 5;

type Kayit = {
  tjkKayitId: string;
  atAdi: string;
  tarih: Date | null;
  kilo: string | null;
  irk: string;
  cinsiyet: string;
  yil: number;
  hipodrom: string;
  pist: string;
  pistDurumu: string;
  mesafe: string;
  derece: string | null;
  cinsAdi: string;
};

async function fetchSayfa(yil: number, sehirId: number, sayfaNo: number): Promise<Kayit[]> {
  const url = `${BASE}?QueryParameter_Yil=${yil}&QueryParameter_SehirId=${sehirId}&PageNumber=${sayfaNo}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  const html = await res.text();
  const $ = cheerio.load(`<table>${html}</table>`);
  const kayitlar: Kayit[] = [];

  $("tr").each((_, tr) => {
    const $tr = $(tr);
    const tds = $tr.find("td");
    if (tds.length < 11) return;
    const href = $tr.find("a").attr("href") ?? "";
    const idMatch = /#(\d+)\s*$/.exec(href);
    const tarihMatch = /QueryParameter_Tarih=(\d{2}%2[fF]\d{2}%2[fF]\d{4})/.exec(href);
    if (!idMatch) return; // kayıt kimliği yoksa upsert edilemez, atla

    const val = (i: number) => $(tds[i]).text().replace(/\s+/g, " ").trim();
    // 2026-08-23 bug: decodeURIComponent zaten "%2f"yi "/"ye çeviriyordu, ardından ikinci
    // .replace("%2f"->".") artık var olmayan bir deseni arıyordu (no-op) — sonuç "11/06/2026"
    // (slash) kalıyordu ama parseTarih nokta bekliyordu, tarih HER ZAMAN null çıkıyordu.
    // Düzeltme: decode ETMEDEN doğrudan "%2f" -> "." çevir.
    const tarihStr = tarihMatch ? tarihMatch[1].replace(/%2[fF]/g, ".") : null;

    kayitlar.push({
      tjkKayitId: idMatch[1],
      atAdi: val(0),
      tarih: tarihStr ? parseTjkDate(tarihStr) : null,
      kilo: val(1) || null,
      irk: val(2),
      cinsiyet: val(3),
      yil: parseInt(val(4), 10) || yil,
      hipodrom: val(5),
      pist: val(6),
      pistDurumu: val(7),
      mesafe: val(8),
      derece: val(9) || null,
      cinsAdi: val(10),
    });
  });
  return kayitlar;
}

export type DereceIstSyncSonuc = { yil: number; toplamSayfa: number; kayitSayisi: number; hataSayfaSayisi: number };

function bekle(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 2026-08-23 kullanıcı bulgusu: art arda iki senkronizasyonda da ~%26 sayfa hatası
// çıktı (41-43/159) — tesadüfi ağ gürültüsü değil, TJK'nın 8 eşzamanlı isteğe karşı
// hız sınırlaması/kısıtlaması olabilir. Başarısız sayfalar artık 3 kez, aralarda kısa
// bir bekleme ile yeniden deneniyor.
async function fetchSayfaRetryli(yil: number, sehirId: number, sayfaNo: number, deneme = 3): Promise<Kayit[]> {
  let sonHata: unknown;
  for (let i = 0; i < deneme; i++) {
    try {
      return await fetchSayfa(yil, sehirId, sayfaNo);
    } catch (e) {
      sonHata = e;
      if (i < deneme - 1) await bekle(500 * (i + 1));
    }
  }
  throw sonHata;
}

/**
 * 2026-09-13 kullanıcı bulgusu (İstanbul K9, SENSEİ BAHA) — zeminMesafeDeneyimi sinyali bu
 * at için "yok" dönüyordu; kovanın (İstanbul/Sentetik/1.500) 108 örneği vardı, sorun kova
 * boyutu DEĞİLDİ — atın KENDİ 20.05.2026 koşusu bu tabloda hiç yoktu (halbuki
 * HorseRaceHistoryCache'te vardı, yani TJK'dan çekilebiliyor). Kök neden: yukarıdaki
 * "~%26 sayfa hatası" notu — başarısız sayfalar SAYILIYOR ama hangi sayfa olduğu hiç
 * kaydedilmiyordu, bu yüzden bir sonraki (aynı biçimdeki) senkron da AYNI sayfalarda
 * şansa bağlı olarak tekrar başarısız olabiliyordu. Artık başarısız sayfa NUMARALARI
 * tutuluyor ve ana geçişten SONRA, kısa bir bekleme ile 2 kez daha YALNIZ o sayfalar
 * tekrar deneniyor — idempotent upsert olduğu için zararsız, yalnızca boşluğu daraltır.
 */
async function basarisizSayfalariTekrarDene(
  yil: number,
  sehirId: number,
  sayfaNolar: number[],
  tumKayitlar: Kayit[]
): Promise<number[]> {
  let kalanlar = sayfaNolar;
  for (let tur = 0; tur < 2 && kalanlar.length > 0; tur++) {
    await bekle(2000 * (tur + 1));
    const yeniKalanlar: number[] = [];
    for (let i = 0; i < kalanlar.length; i += CONCURRENCY) {
      const dilim = kalanlar.slice(i, i + CONCURRENCY);
      const sonuclar = await Promise.all(
        dilim.map(async (sayfaNo) => {
          try {
            return await fetchSayfaRetryli(yil, sehirId, sayfaNo);
          } catch {
            yeniKalanlar.push(sayfaNo);
            return [] as Kayit[];
          }
        })
      );
      for (const s of sonuclar) tumKayitlar.push(...s);
    }
    kalanlar = yeniKalanlar;
  }
  return kalanlar;
}

/** Tek bir şehir için (verilen yıl) TÜM sayfaları çeker — TjkDereceKaydi'ye yazmaz. */
async function senkronizeEtSehir(yil: number, sehirId: number): Promise<{ kayitlar: Kayit[]; toplamSayfa: number; hataSayfaSayisi: number }> {
  const ilkSayfa = await fetchSayfaRetryli(yil, sehirId, 1);
  const ilkHtml = await (
    await fetch(`${BASE}?QueryParameter_Yil=${yil}&QueryParameter_SehirId=${sehirId}`, { headers: HEADERS })
  ).text();
  const toplamMatch = /(\d+)\s*sonu[cç]/i.exec(ilkHtml);
  const toplamSonuc = toplamMatch ? parseInt(toplamMatch[1], 10) : ilkSayfa.length;
  const toplamSayfa = Math.max(1, Math.ceil(toplamSonuc / SAYFA_BOYU));

  const kayitlar: Kayit[] = [...ilkSayfa];
  const basarisizSayfaNolar: number[] = [];

  for (let i = 2; i <= toplamSayfa; i += CONCURRENCY) {
    const dilim = Array.from({ length: Math.min(CONCURRENCY, toplamSayfa - i + 1) }, (_, j) => i + j);
    const sonuclar = await Promise.all(
      dilim.map((sayfaNo) =>
        fetchSayfaRetryli(yil, sehirId, sayfaNo).catch(() => {
          basarisizSayfaNolar.push(sayfaNo);
          return [] as Kayit[];
        })
      )
    );
    for (const s of sonuclar) kayitlar.push(...s);
  }

  const halaBasarisiz = await basarisizSayfalariTekrarDene(yil, sehirId, basarisizSayfaNolar, kayitlar);
  return { kayitlar, toplamSayfa, hataSayfaSayisi: halaBasarisiz.length };
}

/**
 * Verilen yıl için TÜM şehirleri (IDMAN_SEHIR_ID'deki 10 hipodrom) TEK TEK tam sayfalayıp
 * TjkDereceKaydi'ne upsert eder. ŞehirId'siz/-1 sorgu TJK tarafında sessizce ~10.650
 * sonuçta kesiliyor — bkz. dosya başlığındaki 2026-11-07 notu.
 */
export async function syncDereceIstatistikleri(yil: number): Promise<DereceIstSyncSonuc> {
  const sehirIdler = Object.values(IDMAN_SEHIR_ID);
  const tumKayitlar: Kayit[] = [];
  let toplamSayfa = 0;
  let hataSayfaSayisi = 0;

  for (const sehirId of sehirIdler) {
    const sonuc = await senkronizeEtSehir(yil, sehirId);
    tumKayitlar.push(...sonuc.kayitlar);
    toplamSayfa += sonuc.toplamSayfa;
    hataSayfaSayisi += sonuc.hataSayfaSayisi;
    await bekle(300);
  }

  const BATCH = 500;
  for (let i = 0; i < tumKayitlar.length; i += BATCH) {
    const dilim = tumKayitlar.slice(i, i + BATCH);
    await Promise.all(
      dilim.map((k) =>
        db.tjkDereceKaydi.upsert({
          where: { tjkKayitId_atAdi: { tjkKayitId: k.tjkKayitId, atAdi: k.atAdi } },
          create: k,
          update: k,
        })
      )
    );
  }

  return { yil, toplamSayfa, kayitSayisi: tumKayitlar.length, hataSayfaSayisi };
}
