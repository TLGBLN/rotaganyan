import Anthropic from "@anthropic-ai/sdk";
import { logClaudeUsage } from "@/lib/claude-cost";

export const client = new Anthropic();

/**
 * Anthropic SDK, max_tokens yüksekken (yaklaşık ~21.000'i geçince, thinking'in
 * max_tokens'ten görünmeyen pay alması nedeniyle) senkron (non-streaming) isteği
 * İSTEK GÖNDERİLMEDEN reddediyor: "Streaming is required for operations that may
 * take longer than 10 minutes." Bu ücretsiz bir client-side hata (API'ye hiç
 * gitmiyor) ama admin'e sürekli hata gösterip analiz üretilmesini engelliyor.
 * Çözüm: her zaman stream() + finalMessage() kullanmak — bu limiti tamamen
 * ortadan kaldırıyor (SDK'nın kendi dokümante ettiği önerisi budur).
 */
export async function createStreamed(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> {
  const stream = client.messages.stream(params);
  return stream.finalMessage();
}

/**
 * Adaptive thinking, Sonnet 5'te max_tokens'ten görünmeyen bir pay aldığı için
 * (budget_tokens ile sınırlandırılamıyor — Sonnet 5'te 400 hatası verir) kalabalık
 * sahalarda yanıt bazen ilk denemede yarıda kesilebilir. Admin'e "tekrar dene"
 * dedirtip Faz 2/4'ü baştan bir kez daha ÜCRETLENDİRMEK yerine, aynı istek içinde
 * otomatik olarak daha yüksek bir limitle BİR kez tekrar dene — kullanıcı ekstra
 * tıklama ve ekstra bekleme olmadan sonuç alır.
 */
export async function createWithTruncationRetry(
  params: Anthropic.MessageCreateParamsNonStreaming,
  raceId: string,
  phase: "faz2" | "faz4" | "faz4notes",
  retryMaxTokens: number
) {
  let msg = await createStreamed(params);
  await logClaudeUsage({
    raceId, phase, model: "claude-sonnet-5",
    inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens,
    cacheCreationInputTokens: msg.usage.cache_creation_input_tokens ?? 0,
    cacheReadInputTokens: msg.usage.cache_read_input_tokens ?? 0,
    resultText: extractText(msg),
  });
  if (msg.stop_reason === "max_tokens") {
    msg = await createStreamed({ ...params, max_tokens: retryMaxTokens });
    await logClaudeUsage({
      raceId, phase, model: "claude-sonnet-5",
      inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens,
      cacheCreationInputTokens: msg.usage.cache_creation_input_tokens ?? 0,
      cacheReadInputTokens: msg.usage.cache_read_input_tokens ?? 0,
      resultText: extractText(msg),
    });
  }
  return msg;
}

/**
 * Thinking açıkken content[] dizisinin İLK elemanı "thinking" bloğu oluyor, asıl JSON
 * metni sonraki bir elemanda geliyor — content[0]'ı sabit varsayıp okumak (eski kod)
 * thinking her tetiklendiğinde boş string döndürüp "yanıtı parse edilemedi" hatasına
 * yol açıyordu (token sınırından bağımsız, canlı API'ye atılan bir tanı isteğiyle
 * doğrulandı). Doğrusu, tipine göre "text" bloğunu aramak.
 */
export function extractText(msg: Anthropic.Message): string {
  const textBlock = msg.content.find((c): c is Anthropic.TextBlock => c.type === "text");
  return textBlock ? textBlock.text.trim() : "";
}

/** Bir §IV kartının "**BAŞLIK:**" kısmını büyük harfle döner — eşleştirme başlığa göre yapılır, gövde metnine göre değil (gövdede geçen kelimeler yanlış karta düşürmesin diye). */
function kartBasligi(kart: string): string {
  return (kart.match(/^\*\*([^*]+):\*\*/)?.[1] ?? "").toUpperCase();
}

/**
 * classType metnini (TJK'nın verdiği ham string, örn. "Handikap 15/DHÖW /H2/Y1") ilgili
 * §IV kartına eşleştirir. Önce Binici Özel (Amatör/Kadın) ve Satış/Sınıf gibi metinde
 * doğrudan görünen etiketleri dener, sonra Handikap/Şartlı/KV/Grup numarasını ayıklar,
 * hiçbiri tutmazsa SKK numarasına (classToSkk ile zaten hesaplanmış) göre kaba bir
 * karta düşer. Hiçbiri tutmazsa undefined döner — çağıran taraf bunu güvenli taraf
 * (tüm §IV'ü gönder) olarak yorumluyor.
 */
function kosuTipiKarti(classType: string, skk: number | null, kartlar: string[]): string | undefined {
  const t = classType.toUpperCase();
  const bul = (re: RegExp) => kartlar.find((k) => re.test(kartBasligi(k)));

  if (/KADIN/.test(t) && /AMAT[ÖO]R/.test(t)) return bul(/KADIN AMAT/);
  if (/KADIN/.test(t)) return bul(/KADIN B[İI]N[İI]C[İI]/);
  if (/AMAT[ÖO]R/.test(t)) return bul(/^AMAT[ÖO]R/);

  if ((/SATIŞ|SATIS/.test(t)) && /MA[İI]DEN/.test(t)) return bul(/MA[İI]DEN SATIŞ/);
  if (/SATIŞ|SATIS|CLAIMING/.test(t)) {
    const n = t.match(/SAT(?:IŞ|IS)\s*(\d)/)?.[1];
    if (n && bul(new RegExp(`^SATIŞ ${n}\\b`))) return bul(new RegExp(`^SATIŞ ${n}\\b`));
    return bul(/^SATIŞ \d/); // numara okunamadıysa herhangi bir satış kartı — bağlam en azından doğru
  }

  if (/\bSINIF\b/.test(t)) return bul(/SINIF KOŞUSU/);

  if (/\bG\s?1\b/.test(t)) return bul(/^GRUP G1/);
  if (/\bG\s?2\b/.test(t)) return bul(/^GRUP G2/);
  if (/\bG\s?3\b/.test(t)) return bul(/^GRUP G3/);

  if (/KV[\s-]?18\b|KV[\s-]?24\b/.test(t)) return bul(/KV-18/);
  if (/KV[\s-]?6\b/.test(t)) return bul(/^KV-6\b/);
  if (/KV[\s-]?7\b/.test(t)) return bul(/^KV-7\b/);
  if (/KV[\s-]?8\b/.test(t)) return bul(/^KV-8\b/);
  if (/KV[\s-]?9\b/.test(t)) return bul(/^KV-9\b/);

  const hMatch = t.match(/HAND[İI]KAP\s*(\d+)/);
  if (hMatch && ["13", "14", "15", "16", "17", "21", "22", "24"].includes(hMatch[1])) {
    return bul(new RegExp(`^HANDİKAP ${hMatch[1]}\\b`));
  }

  const sMatch = t.match(/[ŞS]ARTLI\s*(\d+)/);
  if (sMatch) {
    const n = sMatch[1];
    if (n === "1") return bul(/ŞARTLI 1\b(?!\d)/);
    if (n === "27") return bul(/ŞARTLI 27/);
    if (["2", "3", "4", "5"].includes(n)) return bul(new RegExp(`^ŞARTLI ${n}\\b`));
    if (n === "19") return bul(/ŞARTLI 19/);
  }

  if (/MA[İI]DEN/.test(t)) return bul(/^MA[İI]DEN \//);

  // Metin tanınmadı — SKK'ya göre kaba bir karta düş (classToSkk zaten hesaplanmış).
  if (skk === 1) return bul(/ŞARTLI 1\b(?!\d)/);
  if (skk === 2) return bul(/^MA[İI]DEN \//);
  if (skk === 3) return bul(/^ŞARTLI [234]\b/);
  if (skk === 4) return /HAND[İI]KAP/.test(t) ? bul(/^HANDİKAP 1[3-6]\b/) : bul(/^ŞARTLI 5\b/);
  if (skk === 5) return bul(/^HANDİKAP (17|21|22|24)\b/);
  if (skk === 6) return bul(/^KV-[67]\b/);
  if (skk === 7) return bul(/^KV-[89]\b/);
  if (skk != null && skk >= 8) return bul(/^GRUP/);
  return undefined;
}

/** classType'ta görülen ek işaretlere (çırak jokey bandı, HP puan bandı) göre, ana
 *  tipin ÜSTÜNE eklenen 0-2 ek modifiye kartı seçer — sadece gerçekten geçerliyse. */
function ekModifiyeKartlari(classType: string, kartlar: string[]): string[] {
  const t = classType.toUpperCase();
  const ekler: string[] = [];
  if (/\/Y[0-3]\b/.test(t) || /\bY[0-3]\b/.test(t)) {
    const y = kartlar.find((k) => /^Y-0/.test(kartBasligi(k)));
    if (y) ekler.push(y);
  }
  if (/\/H[123]\b/.test(t) && /HAND[İI]KAP/.test(t)) {
    const h = kartlar.find((k) => /HP PUAN BANTLARI/.test(kartBasligi(k)));
    if (h) ekler.push(h);
  }
  return ekler;
}

/**
 * Metodolojinin "IV. KOŞU TİPİ ÖZET MATRİSLERİ" bölümü ~30 kart içeriyor (TJK 2026
 * Genel Hükümler ile doğrulanmış ayrıntılı kategori seti — Şartlı/Handikap/KV/Grup/
 * Satış'ın her numarası + Amatör/Kadın Binici/Sınıf Koşusu gibi ayrı kategoriler +
 * mesafe/pist/saha/HP-bandı/çırak-jokey modifiyeleri) ama bir yarışta yalnız BİR ana
 * tip kartı + birkaç modifiye geçerli. Tümünü göndermek hem gereksiz token hem de
 * Claude'un "hangisi bu yarışa uyuyor" diye ekstra düşünmesine yol açıyor. Bu fonksiyon
 * §IV'ü yalnız ilgili kart(lar)la değiştirir — geri kalan bölümler (I-III, V-XX,
 * banko/tiebreaker/yasak gerekçe gibi her koşu tipinde geçerli kurallar, ve puanlama
 * mantığının kendisi — A/B+C sayısal ağırlıkları) AYNEN kalır, yalnız §IV daralıyor.
 * Eşleştirme başarısız olursa (metodoloji formatı değişmiş, beklenmeyen classType vb.)
 * GÜVENLİ TARAF seçilir: tüm §IV olduğu gibi bırakılır — asla sessizce veri kaybedilmez.
 */
export function daraltilmisMetodoloji(
  methodologyText: string,
  classType: string,
  skk: number | null,
  distance: number,
  surface: string,
  atSayisi: number
): string {
  const startMarker = "## IV. KOŞU TİPİ ÖZET MATRİSLERİ";
  const endMarker = "## V. HP İVMESİ";
  const startIdx = methodologyText.indexOf(startMarker);
  const endIdx = methodologyText.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1) return methodologyText; // güvenli taraf: dokunma

  const bolumBasi = methodologyText.slice(0, startIdx);
  const ivIcerik = methodologyText.slice(startIdx + startMarker.length, endIdx).trim();
  const bolumSonu = methodologyText.slice(endIdx);

  const kartlar = ivIcerik.split(/\n\n(?=\*\*)/).map((k) => k.trim()).filter(Boolean);
  if (kartlar.length < 15) return methodologyText; // beklenenden az kart — format değişmiş olabilir, güvenli taraf

  const tipKarti = kosuTipiKarti(classType, skk, kartlar);
  if (!tipKarti) return methodologyText; // sınıf eşleşmedi — güvenli taraf: tüm kartları gönder

  const secilenler = [tipKarti, ...ekModifiyeKartlari(classType, kartlar)];
  if (distance <= 1300) secilenler.push(kartlar.find((k) => k.includes("KISA MESAFE")) ?? "");
  if (distance >= 1900) secilenler.push(kartlar.find((k) => k.includes("UZUN MESAFE")) ?? "");
  if (surface === "KUM") secilenler.push(kartlar.find((k) => k.includes("KUM PİST")) ?? "");
  if (surface === "CIM") secilenler.push(kartlar.find((k) => k.includes("ÇİM PİST")) ?? "");
  if (surface === "SENTETIK") secilenler.push(kartlar.find((k) => k.includes("SENTETİK PİST")) ?? "");
  // gecit-motoru.ts'teki ESIK.kalabalikSahaEsik ile AYNI değer olmalı — biri değişip
  // diğeri unutulursa, motor bonusu uygularken Claude'a kartın kendisi hiç gitmemiş olur.
  if (atSayisi >= 10) secilenler.push(kartlar.find((k) => k.includes("KALABALIK SAHA")) ?? "");

  const daraltilmisIv = [...new Set(secilenler.filter(Boolean))].join("\n\n");
  return `${bolumBasi}${startMarker} (yalnız bu yarışa uyan kart(lar) — geri kalan kartlar alakasız olduğu için çıkarıldı)\n\n${daraltilmisIv}\n\n${bolumSonu}`;
}

/**
 * DENEYSEL (yalnız METODOLOJI_V2=1 açıkken devreye girer) — Faz4/Faz4-final'e giden
 * sharedContext'teki METODOLOJİ kısmından, Faz4'ün girdisinde (ATLAR tablosu, Faz2'yle
 * birebir aynı) hiç karşılığı olmayan salt-Faz2 bölümlerini çıkarır: §IV (koşu tipi
 * ağırlık tabloları — Faz4 yeniden puanlamıyor), §X (RPR/TS — kendi metni bile bu
 * verinin hiç toplanmadığını söylüyor), §XV (veri yeterliliği — kod zaten Faz4
 * çalışmadan ÖNCE bunu kontrol ediyor), §XVIII-XX (post-mortem/hata kodları/tarihsel
 * dersler/veri kaynakları — geçmişe dönük referans, canlı karara girmiyor).
 *
 * BİLEREK DOKUNULMAYANLAR: §V/VI/VII/VIII/XI/XII/XIII. Sebep — §XIV'ün ("kalmalı"
 * listesi) "Geçerli olumsuz kanıtlar" satırı doğrudan bunların tanımına dayanıyor:
 * "tempo aleyhine (§VIII) · somut kilo dezavantajı (§VII) · galop düşüşü (§VI) · ...".
 * Faz4'ün "somut kanıt var mı" triyajı bu tanımları kaybederse ham sayıları yanlış
 * yorumlayabilir — dış incelemede bulunan gerçek bir risk.
 */
export function trimMetodolojiFaz4Icin(sharedContext: string): string {
  const spans: [string, string][] = [
    ["## IV. KOŞU TİPİ ÖZET MATRİSLERİ", "## V. HP İVMESİ"],
    ["## X. RPR / TS ULUSLARARASI DERECE", "## XI. H2H (ZAYIF KANIT)"],
    ["## XV. VERİ YETERLİLİĞİ", "## XVI. GEÇİT ÖZETİ"],
    ["## XVIII. POST-MORTEM VE KALİBRASYON", "# ROTAGANYAN — ÇÖZÜM REJİMİ"],
  ];
  let out = sharedContext;
  for (const [start, end] of spans) {
    const s = out.indexOf(start);
    const e = out.indexOf(end, s + 1);
    if (s === -1 || e === -1) continue; // güvenli taraf: bulunamazsa dokunma, sessizce atlanır
    out = out.slice(0, s) + out.slice(e);
  }
  return out;
}

// Claude'un cevabını YALNIZCA prompt talimatıyla JSON'a zorlamak yerine, API'nin kendi
// şema doğrulamasını (output_config.format) kullanıyoruz — "geçerli JSON döndür" gibi
// bir talimata güvenmek yerine sunucu tarafında zorunlu kılınıyor.
//
// v4.16: Kullanıcının "Harmanlama / Tek Puanlama Deneyi" bulgularına göre A(0-60)/B+C(0-40)
// katmanlı model kaldırıldı — kullanıcının kendi tespiti: harmanlama yalnız METİN/gerekçe
// seviyesinde oluyordu, PUAN hesaplamasına hiç yansımıyordu (iki veri çelişse bile toplam
// puan bunu sayısal olarak cezalandırmıyordu). Artık TEK bir "puan" (0-100) alanı var —
// tüm veriler aynı havuzda değerlendirilir, çelişki-tutarlılık çarpanı (bkz. Faz2 prompt'u)
// puana zaten işlenmiş halde gelir; ayrı A/B+C alt toplamı yok.
export const FAZ2_SCHEMA = {
  type: "object",
  properties: {
    atlar: {
      type: "array",
      items: {
        type: "object",
        properties: {
          no: { type: "integer" },
          ad: { type: "string" },
          puan: { type: "number" },
          teknikSira: { type: "integer" },
        },
        required: ["no", "ad", "puan", "teknikSira"],
        additionalProperties: false,
      },
    },
  },
  required: ["atlar"],
  additionalProperties: false,
} as const;

// v4.1: Faz 4 tek istekte hem sıralama/kupon/banko KARARINI hem de her pick için
// gerekçe düzyazısını ÜRETİYORDU — bu, adaptive thinking'le birlikte bazı (özellikle
// kalabalık/karmaşık) koşularda 300sn'lik Vercel penceresini aşıp fonksiyonu ortadan
// kesiyordu. Karar ile gerekçe/banko/kupon yazımı iki ayrı çağrıya bölünmüştü ama
// 2026-07-24'te İstanbul 7.Koşu (13 atlı Handikap) gösterdi ki KARAR çağrısının
// KENDİSİ (geçit motoru triyajı + tüm sahayı sıralama + AGF-favori zorunluluğu)
// tek başına 300sn'yi aşabiliyor — ClaudeUsageLog'da 20+ dakika sonra HİÇ kayıt yoktu
// (ne başarılı ne "max_tokens" ile kesilmiş), yani Vercel işlemi Claude bitirmeden
// duvarda öldürüyordu. Token tavanının artık ilgisi yok — sorun süre. Çözüm: KARAR
// çağrısını da ikiye böl — RANK şeması yalnız sıralama/skor/pedigree/detay üretir
// (en ağır iş: geçit triyajı + tüm sahayı sıralama), FINAL şeması bu KARAR zaten
// belliyken banko/kupon/tempo/genel-yorum + gerekçe metinlerini üretir (daha dar,
// daha az "keşif" gerektiren bir görev). Böylece HİÇBİR çağrıda thinking kısılmadan
// (kullanıcının kalite önceliği korunarak) her çağrının kendi süresi 300sn duvarından
// uzaklaşıyor — split, effort düşürmenin (kalite ödünü) alternatifi olarak seçildi.
export const FAZ4_RANK_SCHEMA = {
  type: "object",
  properties: {
    picks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          rank: { type: "integer" },
          no: { type: "integer" },
          name: { type: "string" },
          score: { type: "integer" },
          pedigreeRating: {
            type: "string",
            enum: ["COK_YUKSEK", "YUKSEK", "GUCLU", "ORTA", "DUSUK", "ZAYIF", "SORU", "BILINMIYOR"],
          },
          isTarget: { type: "boolean" },
          details: { type: "array", items: { type: "string" } },
        },
        required: ["rank", "no", "name", "score", "pedigreeRating", "isTarget", "details"],
        additionalProperties: false,
      },
    },
  },
  required: ["picks"],
  additionalProperties: false,
} as const;

// Bu şema, RANK çağrısının kararı zaten belliyken çalışır — banko/kupon/tempo/genel
// yorum + her pick için (bütçe nedeniyle yalnız ilk 6 — bkz. AIAnalysisPanel.tsx
// NOT_BUTCE_LIMITI) "Kilit Gerekçe" gerekçe metnini tek çağrıda üretir. Gerekçe
// metinleri "gerekceler" adıyla ayrı bir dizi — üst seviye "notes" (genel koşu
// yorumu) alanıyla isim çakışmasını önlemek için.
export const FAZ4_FINAL_SCHEMA = {
  type: "object",
  properties: {
    gerekceler: {
      type: "array",
      items: {
        type: "object",
        properties: { no: { type: "integer" }, note: { type: "string" } },
        required: ["no", "note"],
        additionalProperties: false,
      },
    },
    confidence: { type: "string", enum: ["DUSUK", "ORTA", "YUKSEK"] },
    isBanko: { type: "boolean" },
    bankoNote: { type: "string" },
    notes: { type: "string" },
    tempo: { type: "string" },
    couponNarrow: { type: "string" },
    couponNormal: { type: "string" },
    couponWide: { type: "string" },
  },
  required: [
    "gerekceler", "confidence", "isBanko", "bankoNote", "notes", "tempo",
    "couponNarrow", "couponNormal", "couponWide",
  ],
  additionalProperties: false,
} as const;

// DENEYSEL (yalnız METODOLOJI_V2=1 açıkken, Faz4 + Faz4-final için — Faz2 HARİÇ).
// Anthropic'in prompt cache'i hiyerarşik hash'leniyor: tools/output_config.format →
// system → messages sırasıyla. Şema farklıysa, ondan SONRAKİ her şey (metodoloji+veri
// birebir aynı olsa bile) otomatik geçersiz sayılıyor — dış incelemede doğrulandı,
// gerçek loglarda da doğrulandı: Faz4↔Faz4-final arasında cacheRead>0 gerçekten görüldü
// (Ankara 5.Koşu testi, Faz4-final %73 daha ucuza geldi).
//
// 2026-07-25 GERİ ALINDI: Faz2'yi de bu şemaya (+ "atlar" alanını) katıp üçünü
// birleştirme denemesi, gerçek bir koşuda (6 at, küçük saha — saha büyüklüğüyle
// ilgisi yok) "Grammar compilation timed out" 400 hatası verdi. Anthropic'in kendi
// dokümantasyonu bunu doğruluyor: çok sayıda opsiyonel üst-seviye alan + iç içe
// dizi+enum kombinasyonu, yapısal çıktı derleyicisinin "grammar" yollarını katlanarak
// çoğaltıyor. İKİ alanlı (yalnız Faz4/Faz4-final) hâli GERÇEKTEN TEST EDİLDİ ve
// çalıştığı kanıtlandı — bu yüzden şema yalnız bu ikisini kapsıyor, Faz2 asla dahil
// edilmedi/edilmeyecek (kanıtlanmamış bir kazanç için kanıtlanmış bir kırılganlık
// riske atılmaz). Faz4/Faz4-final'e giden metin de kısaltılıyor (bkz. o dosyalardaki
// not) — bu ikisi zaten aynı kısaltılmış metni paylaştığı için cache bozulmuyor.
//
// Hiçbir alan `required` değil (JSON Schema kuralı: required'da olmayan alan tamamen
// atlanabilir) — Faz4 yalnız "picks", Faz4-final yalnız "gerekceler"+banko/kupon
// alanlarını doldurur; öbür fazın alanları şemada TANIMLI ama zorunlu olmadığı için
// model onları doldurmaya mecbur kalmaz. Prompt METNİ zaten hangi alanların
// isteneceğini açıkça söylüyor. Güvenlik: her route yalnız kendi ilgili alanını
// okuyor — modelin şemada izinli ama alakasız bir alanı doldurması durumunda bile o
// veri hiçbir zaman kullanılmıyor, sessizce göz ardı ediliyor.
export const FAZ_SHARED_SCHEMA = {
  type: "object",
  properties: {
    picks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          rank: { type: "integer" },
          no: { type: "integer" },
          name: { type: "string" },
          score: { type: "integer" },
          pedigreeRating: {
            type: "string",
            enum: ["COK_YUKSEK", "YUKSEK", "GUCLU", "ORTA", "DUSUK", "ZAYIF", "SORU", "BILINMIYOR"],
          },
          isTarget: { type: "boolean" },
          details: { type: "array", items: { type: "string" } },
        },
        required: ["rank", "no", "name", "score", "pedigreeRating", "isTarget", "details"],
        additionalProperties: false,
      },
    },
    gerekceler: {
      type: "array",
      items: {
        type: "object",
        properties: { no: { type: "integer" }, note: { type: "string" } },
        required: ["no", "note"],
        additionalProperties: false,
      },
    },
    confidence: { type: "string", enum: ["DUSUK", "ORTA", "YUKSEK"] },
    isBanko: { type: "boolean" },
    bankoNote: { type: "string" },
    notes: { type: "string" },
    tempo: { type: "string" },
    couponNarrow: { type: "string" },
    couponNormal: { type: "string" },
    couponWide: { type: "string" },
  },
  required: [],
  additionalProperties: false,
} as const;

export type Faz2Atlar = {
  atlar: { no: number; ad: string; puan: number; teknikSira: number | null }[];
};

export type Faz4DecisionPick = {
  rank: number; no: number; name: string; score: number;
  pedigreeRating: string; isTarget: boolean; details: string[];
};
export type Faz4RankResult = { picks: Faz4DecisionPick[] };
export type Faz4FinalResult = {
  gerekceler: { no: number; note: string }[];
  confidence: string; isBanko: boolean; bankoNote: string;
  notes: string; tempo: string; couponNarrow: string; couponNormal: string; couponWide: string;
};
