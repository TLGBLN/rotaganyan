import type { Metadata } from "next";
import { BarChart3, Bell, Satellite, Sparkles, Ticket, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import AuthTabs from "../AuthTabs";
import RegisterForm from "./RegisterForm";

export const metadata: Metadata = { title: "Kayıt Ol" };

type Props = { searchParams: Promise<{ callbackUrl?: string }> };

const MEMBER_FEATURES = [
  { icon: BarChart3, text: "Tüm koşu analizleri ve banko önerileri" },
  { icon: TrendingUp, text: "Rotaganyan Puan Tablosu ve tahmin önerileri" },
  { icon: Bell, text: "At takip özelliği ve koşu bildirimleri" },
  { icon: Ticket, text: "Kombine kupon önerileri" },
];

export default async function KayitPage({ searchParams }: Props) {
  const { callbackUrl } = await searchParams;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Üye Ol</CardTitle>
        <CardDescription>30 saniyede ücretsiz hesabınızı oluşturun, tüm analizlere anında erişin.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <AuthTabs active="kayit" callbackUrl={callbackUrl} />

        <div className="flex items-start gap-2.5 rounded-lg border border-target/25 bg-target/[0.06] px-3 py-2.5 text-xs text-muted-foreground">
          <Satellite className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-target" />
          <span>
            <span className="font-semibold text-foreground">TJK Accurace</span> GPS/sektörel zamanlama verisiyle her atın gerçek yarış stilini (Kaçak · Öncü · Presçi · Takipçi · Bekleyen) hesap açmadan görün.
          </span>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-brand/25 bg-gradient-to-br from-brand/[0.08] via-card to-card px-4 py-4">
          <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-brand/10 blur-2xl" />
          <div className="relative mb-3 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-brand" />
            <p className="text-xs font-semibold uppercase tracking-wide text-brand">Üye olunca açılanlar</p>
          </div>
          <ul className="relative space-y-2.5">
            {MEMBER_FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-2.5 text-sm text-foreground">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/15">
                  <Icon className="h-3.5 w-3.5 text-brand" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <RegisterForm callbackUrl={callbackUrl} />
      </CardContent>
    </Card>
  );
}
