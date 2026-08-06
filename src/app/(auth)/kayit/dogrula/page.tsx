import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, CardContent } from "@/components/ui/card";
import VerifyCodeForm from "./VerifyCodeForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.verifyCode");
  return { title: t("metaTitle") };
}

type Props = { searchParams: Promise<{ email?: string; callbackUrl?: string }> };

export default async function KayitDogrulaPage({ searchParams }: Props) {
  const { email, callbackUrl } = await searchParams;
  if (!email) redirect("/kayit");

  return (
    <Card>
      <CardContent className="pt-6">
        <VerifyCodeForm email={email} callbackUrl={callbackUrl} />
      </CardContent>
    </Card>
  );
}
