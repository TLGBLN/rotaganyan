"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2 } from "lucide-react";
import { PAYMENTS_ENABLED } from "@/lib/payments";

const FEATURES = [
  "Tüm yarış analizlerine tam erişim",
  "Banko koşu ipuçlarına öncelikli erişim",
  "Sınırsız tarihsel arşiv",
  "Haftalık özet e-postası",
  "AGF & pedigri veri sayfaları",
];

export default function PremiumUpgradePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleUpgrade() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bir hata oluştu");
      if (data.url) router.push(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ödeme başlatılamadı");
      setLoading(false);
    }
  }

  if (!PAYMENTS_ENABLED) {
    return (
      <div className="max-w-sm mx-auto py-10 space-y-3 text-center">
        <h1 className="text-xl font-bold">Premium Üyelik</h1>
        <p className="text-sm text-muted-foreground">
          Ödeme sistemi şu an aktif değil, çok yakında açılacak.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto py-10 space-y-6">
      <div>
        <h1 className="text-xl font-bold">Premium&apos;a Geç</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Aylık ₺149 · İstediğin zaman iptal et
        </p>
      </div>

      <ul className="space-y-2">
        {FEATURES.map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-hit shrink-0" />
            {f}
          </li>
        ))}
      </ul>

      {error && (
        <p className="rounded-md bg-miss/10 text-miss text-sm px-3 py-2">{error}</p>
      )}

      <Button
        className="w-full bg-brand hover:bg-brand/90"
        onClick={handleUpgrade}
        disabled={loading}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Ödemeye Geç
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        Güvenli ödeme Stripe altyapısıyla sağlanmaktadır.
        Kartın şifresi veya bilgileri ROTAGANYAN sunucularında saklanmaz.
      </p>
    </div>
  );
}
