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
// v6.89 — kullanıcı bulgusu 2026-08-10 (Bursa 9.Koşu, grup 5/5): Anthropic'e giden
// bağlantı ara sıra ağ katmanında kesiliyor ([Error: terminated] <- [read ETIMEDOUT]) —
// bizim kodumuzdan bağımsız, geçici bir ağ sorunu. Öncesinde bu, kullanıcıyı elle
// "Tekrar Dene"ye zorluyordu (zararsız — getRecentCachedResult zaten önceki grupları
// tekrar ücretlendirmiyor — ama gereksiz bir adımdı). Artık BİR kez otomatik yeniden
// deneniyor, tıpkı max_tokens kesilmesinde olduğu gibi.
function agBaglantiHatasiMi(err: unknown): boolean {
  const zincir: string[] = [];
  let e: unknown = err;
  for (let i = 0; i < 5 && e; i++) {
    if (e instanceof Error) { zincir.push(e.message); e = (e as { cause?: unknown }).cause; }
    else break;
  }
  const metin = zincir.join(" ").toLowerCase();
  return metin.includes("terminated") || metin.includes("etimedout") || metin.includes("econnreset") || metin.includes("socket hang up");
}

export async function createWithTruncationRetry(
  params: Anthropic.MessageCreateParamsNonStreaming,
  raceId: string,
  phase: "faz2" | "faz3" | "faz2v2" | "faz3v2",
  retryMaxTokens: number
) {
  let start = Date.now();
  let msg: Anthropic.Message;
  try {
    msg = await createStreamed(params);
  } catch (err) {
    if (!agBaglantiHatasiMi(err)) throw err;
    start = Date.now();
    msg = await createStreamed(params);
  }
  await logClaudeUsage({
    raceId, phase, model: "claude-sonnet-5",
    inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens,
    cacheCreationInputTokens: msg.usage.cache_creation_input_tokens ?? 0,
    cacheReadInputTokens: msg.usage.cache_read_input_tokens ?? 0,
    cacheCreation1hInputTokens: msg.usage.cache_creation?.ephemeral_1h_input_tokens ?? 0,
    resultText: extractText(msg),
    durationMs: Date.now() - start,
  });
  if (msg.stop_reason === "max_tokens") {
    start = Date.now();
    msg = await createStreamed({ ...params, max_tokens: retryMaxTokens });
    await logClaudeUsage({
      raceId, phase, model: "claude-sonnet-5",
      inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens,
      cacheCreationInputTokens: msg.usage.cache_creation_input_tokens ?? 0,
      cacheReadInputTokens: msg.usage.cache_read_input_tokens ?? 0,
      cacheCreation1hInputTokens: msg.usage.cache_creation?.ephemeral_1h_input_tokens ?? 0,
      resultText: extractText(msg),
      durationMs: Date.now() - start,
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
// v6.26: kullanıcı talebi 2026-07-30 ("puanlama muhakemeden sonra yapılsa daha realist
// olmaz mı") — eskiden Faz 2 doğrudan bir 0-100 "puan" üretiyordu, Faz 3 o sayıyı
// "başlangıç noktası" sayıp gerekçelendiriyordu. Bir sayı bir kez ortaya çıkınca sonraki
// adım genelde onu DOĞRULAMAYA çalışır, yeniden düşünmez (çapalama/anchoring önyargısı).
// Artık roller TERSİNE: Faz 2 hiçbir sayısal puan üretmeden, yalnız her at için ayrıntılı
// kanıta dayalı "muhakeme" metni yazıyor; "teknikSira" bu muhakemenin doğal, kaba bir
// ÖZETİDİR (yalnız sıralama, ince puan değil) — asıl 0-100 puanlama, bu muhakemeyi girdi
// olarak alan Faz 3'te (bkz. oto-analiz-faz3/route.ts) mekanik formülle yapılır.
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
          teknikSira: { type: "integer" },
          muhakeme: { type: "string" },
        },
        required: ["no", "ad", "teknikSira", "muhakeme"],
        additionalProperties: false,
      },
    },
  },
  required: ["atlar"],
  additionalProperties: false,
} as const;

// v6.0: Fazlar 5'ten (veri+puanlama+geçit+sıralama+gerekçe) 3'e indirildi (kullanıcı
// kararı) — geçit motoru tamamen kaldırıldı.
// v6.26: PUANLAMA artık burada, Faz 3'te yapılıyor (Faz 2'nin ürettiği muhakeme metnini
// girdi alarak) — NİHAİ SIRALAMAYI belirlemek, Kural Denetim Protokolü'nü (§II.4)
// uygulamak hâlâ Claude'un kendisinin işi (Faz 3, "son kontrol" — kullanıcı talimatı:
// Claude'un işi en önemli iş olmalı). Kupon/banko EŞİĞİ (Ekonomik/Normal/Geniş dilimleme,
// puan≥80+fark≥5+risk-yok testi) kod tarafında Claude'un ÜRETTİĞİ nihai sıraya göre
// mekanik uygulanır — ama SIRANIN KENDİSİ tamamen Claude'un muhakemesinin ürünüdür, kod
// bunu ASLA yeniden sıralamaz.
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
  atlar: { no: number; ad: string; teknikSira: number | null; muhakeme: string }[];
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
