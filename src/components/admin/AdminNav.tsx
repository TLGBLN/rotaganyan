"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Newspaper,
  ShoppingBag,
  History,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };
type NavGroup = { section: string | null; items: NavItem[] };

// 2026-09-30 kullanıcı talebi — TR yarış-verisi araçları (Pedigriler/Accurace/Derece/Jokey/
// Antrenör İstatistikleri) dağınık duruyordu, "TR Yarışları" başlığı altında toplandı; yanına
// "YD Yarışları" başlığı da (henüz araç yok, gelecekteki yurt dışı admin araçları için
// ayrılmış bir yer) eklendi — bkz. yd-engine.ts/Analiz Motoru YD V1.0.
const NAV: NavGroup[] = [
  {
    section: null,
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { href: "/admin/analizler", label: "Analizler", icon: FileText },
      // 2026-09-18 kullanıcı talebi: "makale yazabileceğim bir alan" — bu admin CRUD akışı
      // (ArticleForm/TiptapEditor/upsertArticle) projenin İLK commit'inden (2026-06-21) beri
      // vardı ama hiçbir zaman nav'a bağlanmamış, herkese açık sayfası hiç yazılmamıştı.
      { href: "/admin/makaleler", label: "Makaleler", icon: Newspaper },
      { href: "/admin/urunler", label: "RotaGanyan Store", icon: ShoppingBag },
    ],
  },
  {
    section: "TR Yarışları",
    items: [
      { href: "/admin/pedigri", label: "Pedigriler", icon: Dna },
      { href: "/admin/accurace", label: "Accurace Database", icon: Gauge },
      { href: "/admin/derece-istatistikleri", label: "Derece İstatistikleri", icon: CloudRain },
      { href: "/admin/jokey", label: "Jokey İstatistikleri", icon: TrendingUp },
      { href: "/admin/antrenor", label: "Antrenör İstatistikleri", icon: TrendingUp },
    ],
  },
  {
    section: "YD Yarışları",
    items: [],
  },
  {
    section: null,
    items: [
      { href: "/admin/veri-tamligi", label: "Veri Tamlığı", icon: ClipboardCheck },
      { href: "/admin/sonuclar", label: "Sonuçlar", icon: Trophy },
      { href: "/admin/kupon", label: "Kupon Hazırla", icon: Ticket },
      { href: "/admin/kullanicilar", label: "Kullanıcılar", icon: Users },
      { href: "/admin/import", label: "JSON İmport", icon: PackageOpen },
      { href: "/admin/metodoloji", label: "Metodoloji", icon: Settings },
      { href: "/admin/ayarlar", label: "Site Ayarları", icon: LayoutTemplate },
      { href: "/admin/girisler", label: "Giriş Logları", icon: LogIn },
      { href: "/admin/deploy-log", label: "Deploy Kayıtları", icon: History },
    ],
  },
];

export default function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5 p-3">
      {NAV.map((group, gi) => (
        <div key={gi} className={gi > 0 ? "mt-3" : undefined}>
          {group.section && (
            <div className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
              {group.section}
            </div>
          )}
          {group.items.map(({ href, label, icon: Icon, exact }) => {
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
                    : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
