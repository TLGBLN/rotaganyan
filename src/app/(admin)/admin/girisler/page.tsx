import { db } from "@/lib/db";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

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

export default async function GirislerPage() {
  const logs = await db.loginLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { name: true, role: true } } },
  });

  const totalToday = logs.filter(
    (l) => l.createdAt >= new Date(new Date().setHours(0, 0, 0, 0))
  ).length;
  const successToday = logs.filter(
    (l) => l.success && l.createdAt >= new Date(new Date().setHours(0, 0, 0, 0))
  ).length;
  const failedTotal = logs.filter((l) => !l.success).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Giriş Logları</h1>
        <span className="text-xs text-muted-foreground">Son 200 kayıt</span>
      </div>

      {/* Özet */}
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

      {/* Tablo */}
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
                      <span>
                        {flag} {log.city ?? ""}
                      </span>
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
    </div>
  );
}
