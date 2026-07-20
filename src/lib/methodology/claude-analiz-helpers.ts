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
  phase: "faz2" | "faz4",
  retryMaxTokens: number
) {
  let msg = await createStreamed(params);
  await logClaudeUsage({
    raceId, phase, model: "claude-sonnet-5",
    inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens,
    cacheCreationInputTokens: msg.usage.cache_creation_input_tokens ?? 0,
    cacheReadInputTokens: msg.usage.cache_read_input_tokens ?? 0,
  });
  if (msg.stop_reason === "max_tokens") {
    msg = await createStreamed({ ...params, max_tokens: retryMaxTokens });
    await logClaudeUsage({
      raceId, phase, model: "claude-sonnet-5",
      inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens,
      cacheCreationInputTokens: msg.usage.cache_creation_input_tokens ?? 0,
      cacheReadInputTokens: msg.usage.cache_read_input_tokens ?? 0,
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
  if (atSayisi >= 15) secilenler.push(kartlar.find((k) => k.includes("KALABALIK SAHA")) ?? "");

  const daraltilmisIv = [...new Set(secilenler.filter(Boolean))].join("\n\n");
  return `${bolumBasi}${startMarker} (yalnız bu yarışa uyan kart(lar) — geri kalan kartlar alakasız olduğu için çıkarıldı)\n\n${daraltilmisIv}\n\n${bolumSonu}`;
}

// Claude'un cevabını YALNIZCA prompt talimatıyla JSON'a zorlamak yerine, API'nin kendi
// şema doğrulamasını (output_config.format) kullanıyoruz — "geçerli JSON döndür" gibi
// bir talimata güvenmek yerine sunucu tarafında zorunlu kılınıyor.
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
          aPuani: { type: "number" },
          bcPuani: { type: "number" },
          teknikSira: { type: "integer" },
        },
        required: ["no", "ad", "aPuani", "bcPuani", "teknikSira"],
        additionalProperties: false,
      },
    },
  },
  required: ["atlar"],
  additionalProperties: false,
} as const;

export const FAZ4_SCHEMA = {
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
          // Tam sayı zorunlu — "64.6" gibi küsuratlı skorlar kullanıcıya çirkin görünüyordu.
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
    "picks", "confidence", "isBanko", "bankoNote", "notes", "tempo",
    "couponNarrow", "couponNormal", "couponWide",
  ],
  additionalProperties: false,
} as const;

export type Faz2Atlar = {
  atlar: { no: number; ad: string; aPuani: number; bcPuani: number; teknikSira: number | null }[];
};

export type Faz4Pick = {
  rank: number; no: number; name: string; score: number;
  pedigreeRating: string; isTarget: boolean; details: string[];
};
export type Faz4Result = {
  picks: Faz4Pick[]; confidence: string; isBanko: boolean; bankoNote: string;
  notes: string; tempo: string; couponNarrow: string; couponNormal: string; couponWide: string;
};
