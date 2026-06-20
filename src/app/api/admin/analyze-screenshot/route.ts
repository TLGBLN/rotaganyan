import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

interface ExtractedRunner {
  no: number;
  name: string;
  jockey?: string;
  trainer?: string;
  weight?: number;
  weightChange?: number;
  agf?: number;
  sameJockey?: boolean;
  equipmentAdded?: string | null;
  equipmentRemoved?: string | null;
}

const EXTRACT_PROMPT = `Bu bir TJK (Türkiye Jokey Kulübü) koşu bülteni ekran görüntüsüdür.
Tablodaki tüm atları çıkar ve sadece JSON array döndür, başka hiçbir şey yazma.

Her at için bu alanları doldur:
- no: at numarası (integer)
- name: at adı (tam olarak bültendefki gibi, büyük harf)
- jockey: jokey adı (varsa)
- trainer: antrenör/egzersiz jokeyi adı (varsa)
- weight: mevcut kilo (float, örn: 57.5)
- weightChange: önceki koşuya göre kilo farkı (float, negatif = düştü, örn: -2.0)
- agf: AGF yüzdesi (float, "%" olmadan, örn: 23.5)
- sameJockey: sarı üçgen (aynı jokey işareti) var mı? (boolean)
- equipmentAdded: bu koşuda eklenen takı/teçhizat (string veya null)
- equipmentRemoved: bu koşuda çıkarılan takı/teçhizat (string veya null)

Kurallar:
- Bilmediğin/göremediğin alanlar için null kullan, atla
- AGF kolonunu ara, % işareti olmadan sayıyı al
- Kilo değişimi için önceki kolonla farkı hesapla veya bülten gösteriyorsa al
- Sarı üçgen genellikle jokey adının yanında küçük bir üçgen sembolüdür
- Sadece JSON array döndür: [{"no": 1, "name": "...", ...}, ...]`;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY tanımlı değil. .env dosyasına ekleyin." },
      { status: 500 }
    );
  }

  let body: { raceId: string; imageBase64: string; mediaType: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi" }, { status: 400 });
  }

  const { raceId, imageBase64, mediaType } = body;
  if (!raceId || !imageBase64) {
    return NextResponse.json({ error: "raceId ve imageBase64 gerekli" }, { status: 400 });
  }

  // Verify race exists
  const race = await db.race.findUnique({
    where: { id: raceId },
    include: { runners: { select: { id: true, no: true } } },
  });
  if (!race) {
    return NextResponse.json({ error: "Koşu bulunamadı" }, { status: 404 });
  }

  // Call Claude Vision
  const client = new Anthropic({ apiKey });

  let extracted: ExtractedRunner[] = [];
  try {
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: (mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp") ?? "image/jpeg",
                data: imageBase64,
              },
            },
            { type: "text", text: EXTRACT_PROMPT },
          ],
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    // Strip possible markdown code fences
    const clean = text.replace(/```(?:json)?/gi, "").trim();
    extracted = JSON.parse(clean);
  } catch (err) {
    console.error("Claude Vision error:", err);
    return NextResponse.json(
      { error: "Görüntü analizi başarısız. Claude API hatası." },
      { status: 500 }
    );
  }

  if (!Array.isArray(extracted) || extracted.length === 0) {
    return NextResponse.json({ error: "Hiç at verisi çıkarılamadı" }, { status: 422 });
  }

  // Upsert runners with extracted data
  const updates = await Promise.all(
    extracted.map(async (r) => {
      const existing = race.runners.find((x) => x.no === r.no);
      if (existing) {
        return db.runner.update({
          where: { id: existing.id },
          data: {
            name: r.name ?? undefined,
            jockey: r.jockey ?? undefined,
            trainer: r.trainer ?? undefined,
            weight: r.weight ?? undefined,
            weightChange: r.weightChange ?? undefined,
            agf: r.agf ?? undefined,
            sameJockey: r.sameJockey ?? false,
            equipmentAdded: r.equipmentAdded ?? null,
            equipmentRemoved: r.equipmentRemoved ?? null,
          },
        });
      } else {
        // Create new runner if not in DB
        return db.runner.create({
          data: {
            raceId,
            no: r.no,
            name: r.name,
            jockey: r.jockey ?? null,
            trainer: r.trainer ?? null,
            weight: r.weight ?? null,
            weightChange: r.weightChange ?? null,
            agf: r.agf ?? null,
            sameJockey: r.sameJockey ?? false,
            equipmentAdded: r.equipmentAdded ?? null,
            equipmentRemoved: r.equipmentRemoved ?? null,
          },
        });
      }
    })
  );

  return NextResponse.json({
    ok: true,
    raceId,
    updated: updates.length,
    runners: extracted,
  });
}
