import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Premium Aktivasyonu Başarılı" };

export default function PremiumSuccessPage() {
  return (
    <div className="max-w-sm mx-auto py-16 text-center space-y-5">
      <CheckCircle2 className="mx-auto h-14 w-14 text-hit" />
      <h1 className="text-2xl font-bold">Hoş geldin, Premium üye!</h1>
      <p className="text-muted-foreground text-sm">
        Ödemen alındı. Hesabın birkaç saniye içinde Premium&apos;a yükseltilecek.
        Güncellenmemişse sayfayı yenile.
      </p>
      <div className="flex gap-3 justify-center">
        <Button asChild>
          <Link href="/panel">Panelime Git</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/analizler">Analizlere Bak</Link>
        </Button>
      </div>
    </div>
  );
}
