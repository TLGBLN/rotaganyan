import Link from "next/link";
import { cn } from "@/lib/utils";

export default function AuthTabs({ active, callbackUrl }: { active: "giris" | "kayit"; callbackUrl?: string }) {
  const suffix = callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : "";
  const tabs = [
    { key: "giris" as const, href: `/giris${suffix}`, label: "Giriş Yap" },
    { key: "kayit" as const, href: `/kayit${suffix}`, label: "Üye Ol" },
  ];
  return (
    <div className="mb-6 flex rounded-lg bg-muted p-1">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={cn(
            "flex-1 rounded-md py-2 text-center text-sm font-semibold transition-colors",
            active === tab.key
              ? "bg-brand text-brand-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
