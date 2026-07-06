"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Bell, Bookmark } from "lucide-react";

const BASE_NAV = [
  { href: "/panel", label: "Profil", icon: LayoutDashboard, exact: true },
  { href: "/panel/takip-atlarim", label: "Takip Atlarım", icon: Bookmark },
  { href: "/panel/bildirimler", label: "Bildirimler", icon: Bell },
];

export default function PanelNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 lg:flex-col">
      {BASE_NAV.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-brand/10 text-brand"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
