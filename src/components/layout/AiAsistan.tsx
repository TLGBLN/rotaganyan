"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircleQuestion, X, Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ChatMessage = { role: "user" | "assistant"; content: string };

const KARSILAMA: ChatMessage = {
  role: "assistant",
  content:
    "Merhaba! Mesafe, pist, jokey, HP, AGF, galop gibi at yarışı kavramlarında sorularınızı yanıtlarım. Tahminler için menüden ücretsiz \"PRO ANALİZ\" kullanabilirsiniz.",
};

export default function AiAsistan() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([KARSILAMA]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setError(null);
    const nextMessages = [...messages, { role: "user" as const, content: text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/ai-asistan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Hata");
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Beklenmeyen hata");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Asistanı kapat" : "AI Asistan'ı aç"}
        className="fixed bottom-20 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-lg transition-transform hover:scale-105 print:hidden"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircleQuestion className="h-5 w-5" />}
      </button>

      {open && (
        <div className="fixed bottom-36 right-6 z-50 flex h-[28rem] w-80 flex-col overflow-hidden rounded-xl border bg-card shadow-2xl print:hidden">
          <div className="flex items-center gap-2 border-b bg-brand/10 px-3 py-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-brand-foreground">
              <MessageCircleQuestion className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">AI Asistan</div>
              <div className="text-[10px] text-muted-foreground">Genel at yarışı bilgisi</div>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed",
                  m.role === "user" ? "ml-auto bg-brand text-brand-foreground" : "bg-muted text-foreground"
                )}
              >
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> yazıyor…
              </div>
            )}
            {error && <div className="rounded-lg bg-miss/10 px-3 py-2 text-xs text-miss">{error}</div>}
          </div>

          <div className="flex items-center gap-1.5 border-t p-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Bir soru sorun…"
              maxLength={500}
              className="flex-1 rounded-md border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-brand"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={loading || !input.trim()}
              aria-label="Gönder"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand text-brand-foreground disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
