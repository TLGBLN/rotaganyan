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
// kararı) — geçit motoru tamamen kaldırıldı. Faz 2 ham puanları YALNIZ bir BAŞLANGIÇ
// NOKTASI: asıl işi — muhakeme ile NİHAİ SIRALAMAYI belirlemek, Kural Denetim
// Protokolü'nü (§II.4) uygulamak, gerekirse puanı düzeltmek — Claude'un kendisi yapar
// (Faz 3, "son kontrol" — kullanıcı talimatı: Claude'un işi en önemli iş olmalı).
// Kupon/banko EŞİĞİ (Ekonomik/Normal/Geniş dilimleme, puan≥80+fark≥5+risk-yok testi)
// kod tarafında Claude'un ÜRETTİĞİ nihai sıraya göre mekanik uygulanır — ama SIRANIN
// KENDİSİ tamamen Claude'un muhakemesinin ürünüdür, kod bunu ASLA yeniden sıralamaz.
export const FAZ3_SCHEMA = {
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
          score: { type: "number" },
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
    bankoNote: { type: "string" },
    notes: { type: "string" },
    tempo: { type: "string" },
  },
  required: ["picks", "gerekceler", "confidence", "bankoNote", "notes", "tempo"],
  additionalProperties: false,
} as const;

export type Faz2Atlar = {
  atlar: { no: number; ad: string; puan: number; teknikSira: number | null }[];
};

export type Faz3Pick = {
  rank: number; no: number; name: string; score: number;
  pedigreeRating: string; isTarget: boolean; details: string[];
};
export type Faz3Result = {
  picks: Faz3Pick[];
  gerekceler: { no: number; note: string }[];
  confidence: string; bankoNote: string; notes: string; tempo: string;
};
