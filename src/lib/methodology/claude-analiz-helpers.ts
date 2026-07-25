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
  phase: "faz2" | "faz3",
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

// v6.0: Fazlar 5'ten (veri+puanlama+geçit+sıralama+gerekçe) 3'e indirildi (kullanıcı
// kararı) — geçit motoru tamamen kaldırıldı, sıralama/kupon/banko artık KOD tarafında
// Faz2'nin puanına göre MEKANİK hesaplanıyor (yeni metodolojinin §XVIII.2 "puan sırası
// ile nihai sıralama çelişemez" kuralı zaten bunu zorunlu kılıyor — LLM'e bırakmak
// gereksiz risk). Faz 3'ün TEK işi: Kural Denetim Protokolü (§II.4) gözden geçirmesi +
// pedigri değerlendirmesi/iç etiketler (admin rozetleri) + banko notu/genel yorum/tempo
// + yalnız kod tarafından belirlenen ilk 6 at için Kilit Gerekçe (§XIX.1). Bu, eski
// Faz4'ün en ağır kısmını (geçit triyajı + tüm sahayı sıralama) tamamen ortadan
// kaldırıyor — hem daha hızlı hem daha tutarlı (LLM'in sıra/kupon hatası yapma imkanı yok).
export const FAZ3_SCHEMA = {
  type: "object",
  properties: {
    atDegerlendirmeleri: {
      type: "array",
      items: {
        type: "object",
        properties: {
          no: { type: "integer" },
          pedigreeRating: {
            type: "string",
            enum: ["COK_YUKSEK", "YUKSEK", "GUCLU", "ORTA", "DUSUK", "ZAYIF", "SORU", "BILINMIYOR"],
          },
          isTarget: { type: "boolean" },
          details: { type: "array", items: { type: "string" } },
        },
        required: ["no", "pedigreeRating", "isTarget", "details"],
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
    bankoNote: { type: "string" },
    notes: { type: "string" },
    tempo: { type: "string" },
  },
  required: ["atDegerlendirmeleri", "gerekceler", "confidence", "bankoNote", "notes", "tempo"],
  additionalProperties: false,
} as const;

export type Faz2Atlar = {
  atlar: { no: number; ad: string; puan: number; teknikSira: number | null }[];
};

export type Faz3AtDegerlendirme = {
  no: number; pedigreeRating: string; isTarget: boolean; details: string[];
};
export type Faz3Result = {
  atDegerlendirmeleri: Faz3AtDegerlendirme[];
  gerekceler: { no: number; note: string }[];
  confidence: string; bankoNote: string; notes: string; tempo: string;
};
