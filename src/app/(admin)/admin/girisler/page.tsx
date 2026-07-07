import { db } from "@/lib/db";
import { format, formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export const dynamic = "force-dynamic";

function parseBrowser(ua: string): string {
  if (!ua) return "—";
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("OPR/") || ua.includes("Opera/")) return "Opera";
  if (ua.includes("Chrome/")) return "Chrome";
  if (ua.includes("Firefox/")) return "Firefox";
  if (ua.includes("Safari/") && !ua.includes("Chrome")) return "Safari";
  return "Diğer";
}

function parseOS(ua: string): string {
  if (!ua) return "—";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Mac OS")) return "macOS";
  if (ua.includes("Linux")) return "Linux";
  return "Diğer";
}

const COUNTRY_FLAG: Record<string, string> = {
  TR: "🇹🇷", US: "🇺🇸", DE: "🇩🇪", GB: "🇬🇧", FR: "🇫🇷",
  NL: "🇳🇱", RU: "🇷🇺", UA: "🇺🇦", AZ: "🇦🇿",
};

const PATH_LABELS: Record<string, string> = {
  "/program": "Yarış Programı",
  "/altili": "Altılı Ne Verir?",
  "/tahmin-onerileri": "Banko Önerileri",
  "/rotaganyanpuantablosu": "Puan Tablosu",
  "/panel": "Panelim",
  "/giris": "Giriş Sayfası",
  "/kayit": "Kayıt Sayfası",
  "/": "Ana Sayfa",
};

function pathLabel(path: string): string {
  if (PATH_LABELS[path]) return PATH_LABELS[path];
  if (path.startsWith("/yazilar/")) return "Yazı: " + path.replace("/yazilar/", "");
  if (path.startsWith("/panel/")) return "Panel / " + path.replace("/panel/", "");
  return path;
}

function fmtDuration(secs: number | null | undefined): string {
  if (!secs || secs < 2) return "—";
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m}d ${s}s` : `${m}d`;
}

type PageProps = { searchParams: Promise<{ tab?: string }> };

export default async function GirislerPage({ searchParams }: PageProps) {
  const { tab = "girisler" } = await searchParams;

  const [rawLogs, recentViews, topPages, activeUsers] = await Promise.all([
    db.loginLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      include: { user: { select: { name: true, role: true } } },
    }),
    db.pageView.findMany({
      orderBy: { createdAt: "desc" },
      take: 1000,
      where: { userId: { not: null } },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    }),
    db.pageView.groupBy({
      by: ["path"],
      _count: { id: true },
      _avg: { duration: true },
      orderBy: { _count: { id: "desc" } },
      take: 25,
    }),
    db.pageView.findMany({
      where: {
        userId: { not: null },
        createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
      distinct: ["userId"],
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    }),
  ]);

  // Deduplicate login logs
  const seen = new Set<string>();
  const logs = rawLogs.filter((log) => {
    const minute = Math.floor(log.createdAt.getTime() / 60_000);
    const key = `${log.email}|${log.ip ?? ""}|${minute}|${log.success}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const totalToday = logs.filter(
    (l) => l.createdAt >= new Date(new Date().setHours(0, 0, 0, 0))
  ).length;
  const successToday = logs.filter(
    (l) => l.success && l.createdAt >= new Date(new Date().setHours(0, 0, 0, 0))
  ).length;
  const failedTotal = logs.filter((l) => !l.success).length;

  // Group page views by user
  const viewsByUser = new Map<string, typeof recentViews>();
  for (const v of recentViews) {
    if (!v.userId || !v.user) continue;
    const list = viewsByUser.get(v.userId) ?? [];
    list.push(v);
    viewsByUser.set(v.userId, list);
  }

  const tabs = [
    { id: "girisler", label: "Giriş Logları" },
    { id: "ziyaretler", label: "Sayfa Aktivitesi" },
    { id: "populer", label: "En Çok Ziyaret" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Kullanıcı Aktivitesi</h1>
        {activeUsers.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-hit animate-pulse" />
            <span>
              <strong className="text-foreground">{activeUsers.length}</strong> kullanıcı aktif (son 30 dk)
            </span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={`?tab=${t.id}`}
            className={cn(
              "px-3 py-1.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === t.id
                ? "border-brand text-brand"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* ── Giriş Logları ──────────────────────────────────────────────── */}
      {tab === "girisler" && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Bugün toplam", value: totalToday },
              { label: "Bugün başarılı", value: successToday },
              { label: "Başarısız (tüm)", value: failedTotal },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border bg-card p-4 text-center">
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Zaman</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Kullanıcı</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Durum</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">IP</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Konum</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Cihaz</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => {
                  const flag = log.country ? (COUNTRY_FLAG[log.country] ?? log.country) : "";
                  const browser = parseBrowser(log.userAgent);
                  const os = parseOS(log.userAgent);
                  return (
                    <tr
                      key={log.id}
                      className={cn(
                        "border-b last:border-0",
                        i % 2 === 1 && "bg-muted/10",
                        !log.success && "bg-miss/5"
                      )}
                    >
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        <div>{format(log.createdAt, "d MMM HH:mm", { locale: tr })}</div>
                        <div className="text-[10px] opacity-60">{format(log.createdAt, "yyyy")}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{log.user?.name ?? log.email.split("@")[0]}</div>
                        <div className="text-[10px] text-muted-foreground">{log.email}</div>
                        {log.user?.role && log.user.role !== "USER" && (
                          <span className="inline-block mt-0.5 rounded px-1 py-0 bg-brand/15 text-brand text-[9px] font-semibold">
                            {log.user.role}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          variant={log.success ? "default" : "destructive"}
                          className={cn(
                            "text-[10px] px-1.5 py-0",
                            log.success
                              ? "bg-hit/20 text-hit border-hit/30 hover:bg-hit/20"
                              : "bg-miss/20 text-miss border-miss/30 hover:bg-miss/20"
                          )}
                        >
                          {log.success ? "✓ Başarılı" : "✗ Başarısız"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{log.ip}</td>
                      <td className="px-3 py-2">
                        {flag || log.city ? (
                          <span>{flag} {log.city ?? ""}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div>{browser}</div>
                        <div className="text-[10px] text-muted-foreground">{os}</div>
                      </td>
                    </tr>
                  );
                })}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">
                      Henüz giriş logu yok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Sayfa Aktivitesi ──────────────────────────────────────────── */}
      {tab === "ziyaretler" && (
        <div className="space-y-4">
          {activeUsers.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Son 30 Dakika Aktif
              </h3>
              <div className="flex flex-wrap gap-2">
                {activeUsers.map((v) => (
                  <div
                    key={v.userId}
                    className="flex items-center gap-2 rounded-full border border-hit/30 bg-hit/5 px-3 py-1 text-xs"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-hit animate-pulse" />
                    <span className="font-medium">{v.user?.name ?? v.user?.email?.split("@")[0]}</span>
                    <span className="text-muted-foreground">{v.path}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            {[...viewsByUser.entries()].map(([userId, views]) => {
              const user = views[0]?.user;
              if (!user) return null;
              const totalTime = views.reduce((s, v) => s + (v.duration ?? 0), 0);
              const isActive = activeUsers.some((a) => a.userId === userId);
              return (
                <div key={userId} className="rounded-lg border overflow-hidden">
                  <div className="flex items-center justify-between gap-2 bg-muted/30 px-3 py-2">
                    <div className="flex items-center gap-2">
                      {isActive && (
                        <span className="h-2 w-2 rounded-full bg-hit animate-pulse shrink-0" />
                      )}
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/20 text-[10px] font-bold text-brand shrink-0">
                        {user.name?.[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div>
                        <span className="text-sm font-semibold">{user.name ?? "—"}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{user.email}</span>
                        {user.role !== "USER" && (
                          <span className="ml-1.5 rounded px-1 bg-brand/15 text-brand text-[9px] font-semibold">
                            {user.role}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground shrink-0">
                      <div>{views.length} sayfa</div>
                      <div>{fmtDuration(totalTime)} toplam</div>
                    </div>
                  </div>
                  <div className="divide-y">
                    {views.slice(0, 25).map((v) => (
                      <div key={v.id} className="flex items-center gap-3 px-3 py-1.5 text-xs">
                        <span className="w-28 shrink-0 text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(v.createdAt, { locale: tr, addSuffix: true })}
                        </span>
                        <span className="flex-1 font-medium">{pathLabel(v.path)}</span>
                        <span className="hidden sm:block font-mono text-[10px] text-muted-foreground">{v.path}</span>
                        <span className="w-14 text-right tabular-nums text-muted-foreground">
                          {fmtDuration(v.duration)}
                        </span>
                      </div>
                    ))}
                    {views.length > 25 && (
                      <div className="px-3 py-1.5 text-xs text-muted-foreground">
                        +{views.length - 25} daha kayıt…
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {viewsByUser.size === 0 && (
              <div className="rounded-lg border py-12 text-center text-sm text-muted-foreground">
                Henüz kayıtlı sayfa ziyareti yok. Veriler birkaç dakika içinde toplanmaya başlayacak.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── En Çok Ziyaret ──────────────────────────────────────────────── */}
      {tab === "populer" && (
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground w-8">#</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Sayfa</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Ziyaret</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Ort. Süre</th>
              </tr>
            </thead>
            <tbody>
              {topPages.map((row, i) => (
                <tr key={row.path} className={cn("border-b last:border-0", i % 2 === 1 && "bg-muted/10")}>
                  <td className="px-3 py-2 text-muted-foreground tabular-nums">{i + 1}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{pathLabel(row.path)}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{row.path}</div>
                  </td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums">{row._count.id}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {row._avg.duration ? fmtDuration(Math.round(row._avg.duration)) : "—"}
                  </td>
                </tr>
              ))}
              {topPages.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-10 text-center text-muted-foreground">
                    Henüz veri yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
