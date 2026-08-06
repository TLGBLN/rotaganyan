import { NextRequest, NextResponse } from "next/server";
import { client } from "@/lib/methodology/claude-analiz-helpers";

export const maxDuration = 60;

// Herkese açık, canlı bir uç nokta — analiz motorundan (admin tetikli, günde birkaç
// koşu) FARKLI olarak her ziyaretçi istediği kadar mesaj gönderebilir. Basit, sunucu
// bazlı (çoklu instance'ta tam garanti değil ama casual kötüye kullanımı durdurur)
// IP başına dakikalık limit — kullanıcı talebi 2026-07-27: bu sürekli bir maliyet
// kalemi, admin analiz maliyetinden ayrı, kontrolsüz büyümemeli.
const RATE_LIMIT = 8; // dakikada IP başına en fazla mesaj
const rateMap = new Map<string, { count: number; windowStart: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now - entry.windowStart > 60_000) {
    rateMap.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

// Yalnız genel at yarışı kavramları — kullanıcı talebi 2026-07-27: canlı/güncel
// veriye (bugünkü program, sonuçlar) BAĞLANMASIN, maliyeti düşük tutmak için.
// Böyle bir soru gelirse siteye (Yarış Programı / PRO ANALİZ) yönlendirir, uydurmaz.
const SYSTEM_PROMPT = `Sen ROTAGANYAN at yarışı sitesinin genel bilgi asistanısın. Kullanıcılara at yarışı kavramlarını (mesafe, pist türleri — çim/kum/sentetik, jokey, HP/handikap puanı, derece, AGF, galop, pedigri, takı gibi) sade ve anlaşılır şekilde açıklarsın.

KESİN KURALLAR:
- SADECE genel at yarışı kavram/terimlerini açıklarsın. Bugünün yarış programı, hangi at koşuyor, güncel sonuçlar gibi CANLI bilgiye erişimin YOK — böyle bir soru gelirse, kullanıcıyı sitenin "Yarış Programı" sayfasına veya ücretsiz "PRO ANALİZ" özelliğine nazikçe yönlendir, ASLA veri uydurma.
- ASLA belirli bir at için tahmin, bahis önerisi, "şu at kazanır/oynayın" gibi ifadeler kullanma — bunun için kullanıcıyı PRO ANALİZ'e yönlendir.
- Kısa, sade, samimi cümleler kullan (2-4 cümle), gereksiz teknik jargon kullanma.
- Her zaman Türkçe yanıt ver.
- At yarışı dışı bir soru gelirse, nazikçe konudan saptığını belirt ve at yarışı kavramlarına dönmesini rica et.`;

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "Çok fazla mesaj gönderdiniz, biraz bekleyin." }, { status: 429 });
  }

  const body = (await req.json()) as { messages?: ChatMessage[] };
  const messages = (body.messages ?? []).filter((m) => m.content?.trim()).slice(-10); // yalnız son 10 mesaj — bağlam maliyetini sınırlar
  if (messages.length === 0) {
    return NextResponse.json({ error: "Mesaj gerekli" }, { status: 400 });
  }

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });
    const text = msg.content.find((b) => b.type === "text")?.text ?? "";
    return NextResponse.json({ ok: true, reply: text });
  } catch {
    return NextResponse.json({ error: "Asistan şu an yanıt veremiyor, birazdan tekrar deneyin." }, { status: 500 });
  }
}
