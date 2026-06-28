import Anthropic from "@anthropic-ai/sdk";

const RECONSTRUCT_PROMPT = `Aşağıdaki metin bir at yarışı analiz raporundan kopyalanmış ama tablo
biçimi (| işaretleri ve satır araları) kopyalama sırasında kaybolmuş — sütunlar ve
satırlar art arda bitişik şekilde tek bir metin yığınına dönüşmüş.

Görevin: bu bitişik metni dikkatle ayrıştırıp orijinal tablo(ları) GitHub-flavored
markdown pipe-table biçiminde yeniden oluşturmak.

Kurallar:
- Hiçbir sayıyı veya kelimeyi DEĞİŞTİRME, YUVARLAMA ya da İCAT ETME — sadece doğru
  sütunlara/satırlara dağıt. Belirsiz bir hane ayrımı varsa, satırın sırasını
  (1, 2, 3, ...) ve metindeki ipuçlarını (örn. "tiebreaker" notları, toplam puanın
  sıralamayla uyumlu azalan/yakın olması gerektiği) kullanarak en mantıklı ayrımı yap.
- Başlık satırlarını (## NİHAİ SIRALAMA, ## GENEL PROGRAM, vb.) olduğu gibi koru.
- "X yıldız" ifadelerini Pedigri sütununa "⭐" karakteri tekrarı olarak yaz (X tane ⭐).
- Sadece yeniden oluşturulmuş markdown'ı döndür — açıklama, yorum, kod bloğu işareti ekleme.

Metin:
---
{INPUT}
---`;

/**
 * Sohbet arayüzünden render edilmiş tablo kopyalanınca | ve satır sonları kaybolur;
 * Claude'a aynı veriyi gerçek markdown pipe-table'a geri çevirtip parser'ın
 * okuyabileceği hale getiriyoruz. Veri üretmiyor, sadece yeniden biçimlendiriyor.
 */
export async function reconstructFlattenedMarkdown(rawText: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });
  try {
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 4096,
      messages: [
        { role: "user", content: RECONSTRUCT_PROMPT.replace("{INPUT}", rawText) },
      ],
    });
    const text = response.content[0]?.type === "text" ? response.content[0].text : "";
    const cleaned = text.replace(/```(?:markdown|md)?/gi, "").trim();
    return cleaned || null;
  } catch (err) {
    console.error("AI paste-fix error:", err);
    return null;
  }
}
