import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function GET() {
  const msg = await client.messages.create({
    model: "claude-sonnet-5",
    thinking: { type: "adaptive" },
    max_tokens: 2000,
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: { hello: { type: "string" } },
          required: ["hello"],
          additionalProperties: false,
        },
      },
    },
    messages: [{
      role: "user",
      content:
        "12 atlık bir yarışta her at için (kilo, jokey kazanma yüzdesi, son 4 yarış formu, HP ivmesi, " +
        "pedigri, galop verisi gibi 10'dan fazla değişken var) A puanı (0-60) ve B+C puanı (0-40) ver ve " +
        "hangisinin en güçlü aday olduğunu, neden olduğunu adım adım muhakeme ederek gerekçelendir. " +
        "Varsayımsal veriler üret, gerçekçi olsun. Sonunda JSON formatında 'hello' alanına en güçlü atın adını yaz.",
    }],
  });
  return NextResponse.json({
    stop_reason: msg.stop_reason,
    usage: msg.usage,
    contentShape: msg.content.map((c) => ({ type: c.type, len: "text" in c ? c.text.length : null })),
    content: msg.content,
  });
}
