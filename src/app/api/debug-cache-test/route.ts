import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function GET() {
  const shared = "Sabit bağlam metni. ".repeat(400); // ~1600+ token, cache minimumunun üzerinde
  const sharedBlock: Anthropic.TextBlockParam = { type: "text", text: shared, cache_control: { type: "ephemeral" } };

  const msg1 = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 50,
    messages: [{ role: "user", content: [sharedBlock, { type: "text", text: "Bu metinde kaç kelime var, kısaca söyle." }] }],
  });
  const msg2 = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 50,
    messages: [{ role: "user", content: [sharedBlock, { type: "text", text: "Bu metin ne dilde yazılmış, tek kelimeyle söyle." }] }],
  });

  return NextResponse.json({
    call1: msg1.usage,
    call2: msg2.usage,
  });
}
