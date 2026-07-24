import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import {
  createWithTruncationRetry, extractText,
  FAZ4_NOTES_SCHEMA, type Faz4DecisionPick, type Faz4NotesResult,
} from "@/lib/methodology/claude-analiz-helpers";
import { getRecentCachedResult } from "@/lib/claude-cost";
import type { Anthropic } from "@anthropic-ai/sdk";
import type { Role } from "@prisma/client";

// bkz. /api/admin/oto-analiz-faz4 route'undaki not — sıralama/kupon KARARI ile
// "Kilit Gerekçe" düzyazısının yazımı, tek çağrı 300sn'yi aşabildiği için AYRI
// Claude çağrısına bölündü. Bu istek yalnız verilen (değişmeyen) kararı gerekçelendirir —
// karar zaten belli olduğu için Faz4'ün kendisinden daha dar/hızlı bir görev.
export const maxDuration = 300;

type Body = { raceId: string; sharedContext: string; picks: Faz4DecisionPick[] };

async function handlePost(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "EDITOR")) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { raceId, sharedContext, picks } = (await req.json()) as Body;
  if (!raceId || !sharedContext || !picks?.length) {
    return NextResponse.json({ error: "raceId/sharedContext/picks gerekli" }, { status: 400 });
  }

  const sharedContextBlock: Anthropic.TextBlockParam = {
    type: "text",
    text: sharedContext,
    cache_control: { type: "ephemeral" },
  };

  const faz4NotesTail = `Sen ROTAGANYAN v4.1 at yarışı analistisin. Bu, FAZ 4'ün devamı — final sıralama/kupon KARARI zaten verildi, senin işin SADECE her at için kısa gerekçe metni yazmak. Yukarıdaki KOŞU/ATLAR/METODOLOJİ bağlamını (özellikle her atın galop/pedigri/form/sınıf/kilo/tempo verisini) kullan.

## VERİLEN KARAR (değiştirme, yalnız gerekçelendir)
${picks.map((p) => `#${p.no} ${p.name}: rank ${p.rank}, score ${p.score}, pedigreeRating ${p.pedigreeRating}, iç etiketler: ${p.details.join(", ") || "—"}`).join("\n")}

## GÖREVİN
Yukarıdaki HER at için bir "note" yaz: 2 cümlelik, öz ve okunabilir bir gerekçe — bu metin doğrudan kullanıcıya (public "Kilit Gerekçe" sütununa) gidiyor. A/B+C/Atomic Force/HP ivmesi/geçit skoru gibi iç terimler burada GEÇMEZ (bkz. Sunum Kuralı) — sade, yarışseverin anlayacağı dille, o atı neden bu sırada değerlendirdiğini anlat (galop, pedigri, form, sınıf, kilo, tempo gibi somut kanıtlara dayanarak, yukarıdaki ATLAR verisinden). Pedigri hakkında konuşurken §IX'daki "Aygır/hat hakkında uydurma bilgi yasak" kuralına UY — yukarıda verilmeyen bir aygır/hat hakkında (Aygır İstatistiği'nde/adminNote'ta yoksa) spesifik mesafe/pist/karakter iddiası YAZMA, yalnız verilen ham veriyle (isim var/yok, F% gibi) sınırlı kal.

Yanıtı YALNIZCA geçerli JSON olarak ver, başka metin ekleme:
{ "notes": [ { "no": 0, "note": "2 cümlelik gerekçe" } ] }`;

  const cached = await getRecentCachedResult(raceId, "faz4notes");
  let raw: string;
  let stopReasonMaxTokens = false;
  if (cached) {
    raw = cached;
  } else {
    const msg = await createWithTruncationRetry(
      {
        model: "claude-sonnet-5",
        thinking: { type: "adaptive" },
        max_tokens: 16000,
        output_config: { format: { type: "json_schema", schema: FAZ4_NOTES_SCHEMA } },
        messages: [{ role: "user", content: [sharedContextBlock, { type: "text", text: faz4NotesTail }] }],
      },
      raceId, "faz4notes", 24000
    );
    raw = extractText(msg);
    stopReasonMaxTokens = msg.stop_reason === "max_tokens";
  }

  let result: Faz4NotesResult;
  try {
    result = JSON.parse(raw);
  } catch {
    const sebep = stopReasonMaxTokens
      ? " (yanıt otomatik yüksek limitli tekrar denemede de token sınırına takıldı, tekrar deneyin)"
      : "";
    return NextResponse.json({ error: `Gerekçe metinleri parse edilemedi${sebep}`, raw }, { status: 500 });
  }

  return NextResponse.json({ ok: true, notes: result.notes });
}

export async function POST(req: NextRequest) {
  try {
    return await handlePost(req);
  } catch (e) {
    console.error("[oto-analiz-faz4-notes]", e);
    return NextResponse.json({ error: "Beklenmeyen hata: " + String(e) }, { status: 500 });
  }
}
