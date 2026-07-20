import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function GET() {
  const client = new Anthropic();
  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 500,
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: { greeting: { type: "string" }, count: { type: "integer" } },
            required: ["greeting", "count"],
            additionalProperties: false,
          },
        },
      },
      messages: [{ role: "user", content: "Say hello and pick a number between 1 and 10." }],
    });
    const text = msg.content[0].type === "text" ? msg.content[0].text : "";
    const parsed = JSON.parse(text);
    return NextResponse.json({ ok: true, stop_reason: msg.stop_reason, raw: text, parsed });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
