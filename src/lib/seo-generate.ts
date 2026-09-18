import Anthropic from "@anthropic-ai/sdk";

// 2026-09-18 kullanıcı talebi: "SEO otomatik doldur... internette diğer kullanıcıların
// arama yaptıklarında önlerine çıkabilecek düzeyde doldur" — başlık/özetin ham bir
// kopyası (basit auto-sync, ArticleForm.tsx'te zaten var) YETMEZ, gerçekten arama
// motoru görünürlüğünü hedefleyen, muhtemel arama terimlerini içeren, tıklanabilir
// meta metin gerekiyor. ai-paste-fix.ts ile AYNI Anthropic SDK deseni.
const PROMPT = `Sen bir SEO uzmanısın. Aşağıdaki at yarışı analiz makalesi için Google
arama sonuçlarında GERÇEKTEN tıklanma alma ihtimali yüksek bir meta başlık ve meta
açıklama yaz. Hedef kitle: Türkiye'de at yarışı, ganyan, AGF, pedigri, jokey/antrenör
istatistiği arayan kullanıcılar.

Kurallar:
- metaTitle: en fazla 60 karakter, makalenin ANA konusunu ve olası arama terimini
  (örn. hipodrom adı, at ismi, "AGF", "pedigri", "ganyan" gibi) doğal şekilde içersin.
  Tıklama isteği uyandıran ama yanıltıcı olmayan bir ifade kullan.
- metaDescription: en fazla 155 karakter, makalenin somut/özgün bulgusunu (sayı, isim,
  sonuç varsa) öne çıkar, jenerik ("bu yazıda... anlatılıyor" gibi) ifadelerden kaçın.
- İkisi de akıcı, doğal Türkçe olsun — anahtar kelime doldurma (keyword stuffing) YAPMA.
- Yalnız şu JSON'u döndür, başka HİÇBİR açıklama/metin ekleme:
  {"metaTitle": "...", "metaDescription": "..."}

Makale başlığı: {TITLE}
Makale özeti: {EXCERPT}
Makale içeriği (ilk kısım): {BODY}`;

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export async function generateArticleSeo(
  title: string,
  excerpt: string,
  bodyHtml: string
): Promise<{ metaTitle: string; metaDescription: string } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!title.trim()) return null;

  const bodyText = stripHtml(bodyHtml).slice(0, 1500);
  const prompt = PROMPT.replace("{TITLE}", title).replace("{EXCERPT}", excerpt || "(yok)").replace("{BODY}", bodyText || "(yok)");

  const client = new Anthropic({ apiKey });
  try {
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.content[0]?.type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (typeof parsed.metaTitle !== "string" || typeof parsed.metaDescription !== "string") return null;
    return {
      metaTitle: parsed.metaTitle.slice(0, 70),
      metaDescription: parsed.metaDescription.slice(0, 160),
    };
  } catch (err) {
    console.error("SEO generate error:", err);
    return null;
  }
}
