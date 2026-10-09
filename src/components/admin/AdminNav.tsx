"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  Trophy,
  Settings,
  Users,
  PackageOpen,
  Ticket,
  LayoutTemplate,
  LogIn,
  TrendingUp,
  Dna,
  Gauge,
  ClipboardCheck,
  CloudRain,
  Activity,
  SearchCode,
} from "lucide-react";

type NavOge = { href: string; label: string; icon: LucideIcon; exact?: boolean; grup?: string };

const NAV: NavOge[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/analizler", label: "Analizler", icon: FileText, grup: "Analizler" },
  { href: "/admin/root-cause", label: "Root-Cause Analizi", icon: SearchCode, grup: "Analizler" },
  { href: "/admin/kupon", label: "Kupon Hazırla", icon: Ticket, grup: "Analizler" },
  { href: "/admin/pedigri", label: "Pedigriler", icon: Dna },
  { href: "/admin/accurace", label: "Accurace Database", icon: Gauge },
  { href: "/admin/derece-istatistikleri", label: "Derece İstatistikleri", icon: CloudRain },
  { href: "/admin/site-anatomisi", label: "Site Anatomisi", icon: Activity, grup: "Teşhis" },
  { href: "/admin/veri-tamligi", label: "Veri Tamlığı", icon: ClipboardCheck, grup: "Teşhis" },
  { href: "/admin/sonuclar", label: "Sonuçlar", icon: Trophy },
  { href: "/admin/jokey", label: "Jokey İstatistikleri", icon: TrendingUp },
  { href: "/admin/antrenor", label: "Antrenör İstatistikleri", icon: TrendingUp },
  { href: "/admin/kullanicilar", label: "Kullanıcılar", icon: Users },
  { href: "/admin/import", label: "JSON İmport", icon: PackageOpen },
  { href: "/admin/metodoloji", label: "Metodoloji", icon: Settings },
  { href: "/admin/ayarlar", label: "Site Ayarları", icon: LayoutTemplate },
  { href: "/admin/girisler", label: "Giriş Logları", icon: LogIn },
];

export default function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5 p-3">
      {NAV.map(({ href, label, icon: Icon, exact, grup }, i) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        const grupBasligi = grup && grup !== NAV[i - 1]?.grup;
        return (
          <Fragment key={href}>
          {grupBasligi && (
            <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{grup}</p>
          )}
          <Link
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-brand/15 text-brand border-l-2 border-brand pl-[10px]"
                : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
          </Fragment>
        );
      })}
    </nav>
  );
}
