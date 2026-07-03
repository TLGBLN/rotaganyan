import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import RegisterForm from "./RegisterForm";

export const metadata: Metadata = { title: "Kayıt Ol" };

type Props = { searchParams: Promise<{ callbackUrl?: string }> };

const MEMBER_FEATURES = [
  "Tüm koşu analizleri ve banko önerileri",
  "Tahmin önerileri listesi",
  "At takip özelliği ve bildirimler",
  "Kombine kupon önerileri",
];

export default async function KayitPage({ searchParams }: Props) {
  const { callbackUrl } = await searchParams;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Kayıt Ol</CardTitle>
        <CardDescription>Ücretsiz hesabınızı oluşturun.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Üye olunca erişebilecekleriniz</p>
          <ul className="space-y-1.5">
            {MEMBER_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-brand" />
                {f}
              </li>
            ))}
          </ul>
        </div>
        <RegisterForm callbackUrl={callbackUrl} />
        <div className="text-center text-sm text-muted-foreground">
          Zaten hesabınız var mı?{" "}
          <Link
            href={callbackUrl ? `/giris?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/giris"}
            className="text-brand hover:underline"
          >
            Giriş Yap
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
