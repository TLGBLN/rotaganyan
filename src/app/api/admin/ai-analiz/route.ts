import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth, hasRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { scoreRunners } from "@/lib/methodology/engine";
import { TOPICS } from "@/lib/methodology/topics";
import type { Role } from "@prisma/client";

const client = new Anthropic();

function buildMethodologyText(dbContent: string | null): string {
  if (dbContent && dbContent.trim().length > 100) return dbContent.trim();
  // Fallback: topics.ts'den üret
  return TOPICS.map((t) =>
    `### ${t.title}\n${t.guidance}\nKontrol soruları:\n${t.questions.map((q) => `- ${q}`).join("\n")}${t.warning ? `\n⚠️ ${t.warning}` : ""}`
  ).join("\n\n");
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "EDITOR")) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { raceId, chatgptAnalysis } = await req.json() as { raceId: string; chatgptAnalysis: string };
  if (!raceId || !chatgptAnalysis?.trim()) {
    return NextResponse.json({ error: "raceId ve chatgptAnalysis gerekli" }, { status: 400 });
  }

  // Koşu + runner verilerini çek
  const race = await db.race.findUnique({
    where: { id: raceId },
    include: {
      raceDay: { include: { hippodrome: true } },
      runners: {
        where: { scratched: false },
        orderBy: { no: "asc" },
        include: {
          gallops: { orderBy: { date: "desc" }, take: 3 },
        },
      },
    },
  });
  if (!race) return NextResponse.json({ error: "Koşu bulunamadı" }, { status: 404 });

  // Site motorunu çalıştır
  const scored = scoreRunners(
    race.runners.map((r) => ({
      id: r.id,
      no: r.no,
      name: r.name,
      weight: r.weight,
      weightChange: r.weightChange,
      agf: r.agf,
      sameJockey: r.sameJockey,
      equipmentAdded: r.equipmentAdded,
      gallops: r.gallops.map((g) => ({ form: g.form, date: g.date })),
    }))
  ).sort((a, b) => b.totalScore - a.totalScore);

  // Metodoloji (DB'den al, yoksa topics.ts fallback)
  const methodology = await db.methodologyVersion.findFirst({ where: { isCurrent: true } });
  const methodologyText = buildMethodologyText(methodology?.content ?? null);

  // Runner tablosu oluştur
  const runnerTable = scored
    .map((r, i) => {
      const galop = r.gallops[0]?.form ?? "—";
      const agfPct = r.agf != null ? `%${r.agf.toFixed(1)}` : "—";
      return `${i + 1}. | #${r.no} ${r.name} | Site:${r.totalScore} | AGF:${agfPct} | Galop:${galop} | Pedigri:${r.pedigreeRating ?? "?"} | Banko aday:${r.isBankoCandidate ? "Evet" : "Hayır"}`;
    })
    .join("\n");

  const prompt = `Sen at yarışı analiz asistanısın. Görevin: ChatGPT sıralamasını, site motorunun hesapladığı puanları ve metodoloji kurallarını birleştirerek FINAL karar vermek.

## KOŞU
${race.raceDay.hippodrome.name} — ${race.raceNo}. Koşu | ${race.classType} | ${race.distance}m | ${race.runners.length} at

## SİTE MOTOR SONUÇLARI (AGF + Galop + Pedigri hesabı)
Sıra | At | Site Puanı | AGF | Galop | Pedigri | Banko Aday
${runnerTable}

## ChatGPT ANALİZİ VE SIRALAMASI
${chatgptAnalysis.trim()}

## METODOLOJİ REHBERİ
${methodologyText}

## GÖREVİN
1. ChatGPT'nin sıralamasından at numaralarını tespit et
2. Site motoruyla karşılaştır — uyuşuyor mu, çelişiyor mu?
3. Metodoloji kurallarını uygula: derece > sicil > AGF > galop > pedigri
4. Her çelişkide metodoloji lehine karar ver ve neden kısa açıkla
5. 3 pick üret (en güçlüden en zayıfa)
6. Banko koşullarına bak: Handikap/Grup → ASLA banko

Yanıtı YALNIZCA geçerli JSON olarak ver, başka metin ekleme:
{
  "picks": [
    { "rank": 1, "no": 0, "name": "...", "score": 0, "pedigreeRating": "BILINMIYOR", "isTarget": false, "details": [], "note": "Neden 1. sırada (max 2 cümle)" },
    { "rank": 2, "no": 0, "name": "...", "score": 0, "pedigreeRating": "BILINMIYOR", "isTarget": false, "details": [], "note": "" },
    { "rank": 3, "no": 0, "name": "...", "score": 0, "pedigreeRating": "BILINMIYOR", "isTarget": false, "details": [], "note": "" }
  ],
  "confidence": "ORTA",
  "isBanko": false,
  "bankoNote": "",
  "notes": "ChatGPT ile site arasındaki uyum/çelişki özeti ve genel koşu değerlendirmesi",
  "tempo": "Tempo beklentisi",
  "couponNarrow": "X",
  "couponNormal": "X-Y",
  "couponWide": "X-Y-Z"
}

pedigreeRating değerleri: COK_YUKSEK, YUKSEK, GUCLU, ORTA, DUSUK, ZAYIF, SORU, BILINMIYOR
details örnekleri: AGF1, AGF2, Galop K1, Galop A1, Kilo düştü, Sicil, Sınıf düşüşü, Jokey devam`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "";

  // JSON bloğunu çıkar (```json ... ``` içinde gelebilir)
  const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/) ?? raw.match(/(\{[\s\S]*\})/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : raw;

  let result;
  try {
    result = JSON.parse(jsonStr);
  } catch {
    return NextResponse.json({ error: "AI yanıtı parse edilemedi", raw }, { status: 500 });
  }

  return NextResponse.json({ ok: true, result, runners: scored.map((r) => ({ id: r.id, no: r.no, name: r.name })) });
}
