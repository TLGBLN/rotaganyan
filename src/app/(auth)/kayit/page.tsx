import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import RegisterForm from "./RegisterForm";

export const metadata: Metadata = { title: "Kayıt Ol" };

type Props = { searchParams: Promise<{ callbackUrl?: string }> };

export default async function KayitPage({ searchParams }: Props) {
  const { callbackUrl } = await searchParams;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Kayıt Ol</CardTitle>
        <CardDescription>Ücretsiz hesabınızı oluşturun.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
