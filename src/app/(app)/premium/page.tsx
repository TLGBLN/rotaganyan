import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { CheckCircle2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PAYMENTS_ENABLED } from "@/lib/payments";

export const metadata: Metadata = {
  title: "Premium Üyelik",
  description: "ROTAGANYAN Premium ile tüm analizlere erişin, banko ipuçlarını erkenden görün.",
};

const FEATURES = [
  { label: "Tüm yarış analizlerine tam erişim", premium: true, free: false },
  { label: "Banko koşu ipuçlarına öncelikli erişim", premium: true, free: false },
  { label: "Sınırsız tarihsel arşiv", premium: true, free: false },
  { label: "Haftalık özet e-postası", premium: true, free: false },
  { label: "AGF & pedigri veri sayfaları", premium: true, free: false },
  { label: "Son 5 analizin görüntülenmesi", premium: false, free: true },
  { label: "İstatistik sayfası", premium: false, free: true },
  { label: "Rehber makaleleri", premium: false, free: true },
];

export default async function PremiumPage() {
  const session = await auth();
  const isAlreadyPremium = session?.user?.plan === "PREMIUM";

  // Count upcoming analyses (next 7 days unlocked for premium)
  const upcomingCount = await db.prediction.count({
    where: { published: true },
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 space-y-12">
      <div className="text-center space-y-3">
        <Badge className="mb-2 bg-brand/10 text-brand border-brand/30">Premium Üyelik</Badge>
        <h1 className="text-3xl font-bold">
          Analizin tamamına <span className="text-brand">erişin</span>
        </h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          {upcomingCount} yayımlanmış analiz ve sürekli büyüyen arşiv sizi bekliyor.
          Premium üyelikle hiçbir koşuyu kaçırmayın.
        </p>
      </div>

      {/* Pricing cards */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Free */}
        <div className="rounded-lg border p-6 space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Ücretsiz</p>
            <p className="text-3xl font-bold mt-1">₺0</p>
            <p className="text-xs text-muted-foreground">Hesap açtıktan sonra</p>
          </div>
          <ul className="space-y-2">
            {FEATURES.map((f) => (
              <li key={f.label} className="flex items-center gap-2 text-sm">
                {f.free ? (
                  <CheckCircle2 className="h-4 w-4 text-hit shrink-0" />
                ) : (
                  <Lock className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                )}
                <span className={f.free ? "" : "text-muted-foreground/50"}>{f.label}</span>
              </li>
            ))}
          </ul>
          {!session && (
            <Button variant="outline" className="w-full" asChild>
              <Link href="/kayit">Ücretsiz Kayıt Ol</Link>
            </Button>
          )}
        </div>

        {/* Premium */}
        <div className="rounded-lg border border-brand/40 bg-brand/5 p-6 space-y-4 relative">
          <div className="absolute top-3 right-3">
            <Badge className="bg-brand text-white text-xs">Önerilen</Badge>
          </div>
          <div>
            <p className="text-sm font-medium text-brand">Premium</p>
            <p className="text-3xl font-bold mt-1">₺149</p>
            <p className="text-xs text-muted-foreground">aylık · KDV dahil</p>
          </div>
          <ul className="space-y-2">
            {FEATURES.map((f) => (
              <li key={f.label} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-hit shrink-0" />
                <span>{f.label}</span>
              </li>
            ))}
          </ul>
          {isAlreadyPremium ? (
            <div className="rounded-md bg-hit/10 text-hit text-center text-sm py-2 font-medium">
              Zaten Premium üyesiniz ✓
            </div>
          ) : PAYMENTS_ENABLED ? (
            <Button className="w-full bg-brand hover:bg-brand/90" asChild>
              <Link href={session ? "/panel/premium-upgrade" : "/kayit?sonra=/premium"}>
                {session ? "Premium'a Geç" : "Kayıt Ol ve Premium Al"}
              </Link>
            </Button>
          ) : (
            <Button className="w-full" disabled>
              Çok Yakında
            </Button>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Ödeme sistemi entegrasyonu yakında · Şu an için{" "}
        <a href="mailto:destek@rotaganyan.com" className="underline underline-offset-2">
          destek@rotaganyan.com
        </a>{" "}
        adresine yazın.
      </p>
    </main>
  );
}
