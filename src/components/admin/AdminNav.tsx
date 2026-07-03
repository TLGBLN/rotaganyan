"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  Flag,
  Trophy,
  Settings,
  Users,
  PackageOpen,
  Ticket,
  LayoutTemplate,
} from "lucide-react";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/analizler", label: "Analizler", icon: FileText },
  { href: "/admin/kosular", label: "Koşular", icon: Flag },
  { href: "/admin/sonuclar", label: "Sonuçlar", icon: Trophy },
  { href: "/admin/kupon", label: "Kupon Hazırla", icon: Ticket },
  { href: "/admin/kullanicilar", label: "Kullanıcılar", icon: Users },
  { href: "/admin/import", label: "JSON İmport", icon: PackageOpen },
  { href: "/admin/metodoloji", label: "Metodoloji", icon: Settings },
  { href: "/admin/ayarlar", label: "Site Ayarları", icon: LayoutTemplate },
];

export default function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5 p-3">
      {NAV.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-brand/15 text-brand border-l-2 border-brand pl-[10px]"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
