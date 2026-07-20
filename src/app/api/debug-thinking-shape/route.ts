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
    messages: [{ role: "user", content: "2+2 kaç eder? Kısaca düşün, sonra JSON döndür." }],
  });
  return NextResponse.json({
    stop_reason: msg.stop_reason,
    usage: msg.usage,
    contentShape: msg.content.map((c) => ({ type: c.type, len: "text" in c ? c.text.length : null })),
    content: msg.content,
  });
}
