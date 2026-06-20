import { auth } from "@/lib/auth";
import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PAYMENTS_ENABLED } from "@/lib/payments";
import type { Plan } from "@prisma/client";

type Props = {
  children: React.ReactNode;
  requiredPlan?: Plan;
  fallback?: React.ReactNode;
};

export default async function PremiumGate({
  children,
  requiredPlan = "PREMIUM",
  fallback,
}: Props) {
  const session = await auth();
  const userPlan = (session?.user?.plan as Plan | undefined) ?? "FREE";

  if (requiredPlan === "PREMIUM" && userPlan !== "PREMIUM") {
    if (fallback) return <>{fallback}</>;

    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-target/40 bg-target/5 py-10 text-center">
        <Lock className="h-8 w-8 text-target/60" />
        <p className="font-semibold text-target">Premium İçerik</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Bu içeriğe erişmek için Premium üyelik gerekiyor.
        </p>
        {PAYMENTS_ENABLED && (
          <Button asChild size="sm" className="bg-target hover:bg-target/90 text-white">
            <Link href="/premium">Premium&apos;a Geç</Link>
          </Button>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
